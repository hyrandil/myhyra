import Image from 'next/image';
import { notFound } from 'next/navigation';
import bwipjs from 'bwip-js/node';

import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface LabelPageProps {
  params: { code: string };
}

export default async function LabelPage({ params }: LabelPageProps) {
  const item = await prisma.item.findUnique({
    where: { itemCode: params.code },
    include: { location: true },
  });

  if (!item) {
    notFound();
  }

  const barcodeBuffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text: item.itemCode,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: 'center',
    paddingwidth: 10,
    paddingheight: 8,
  });
  const dataUrl = `data:image/png;base64,${barcodeBuffer.toString('base64')}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4 print:min-h-0 print:bg-white print:p-0">
      <div className="w-[360px] rounded-xl border border-zinc-200 bg-white p-4 text-center text-sm">
        <Image src={dataUrl} alt="Barcode" width={360} height={140} sizes="100vw" unoptimized className="mx-auto w-full" />
        <p className="mt-3 font-medium text-zinc-900">{item.name}</p>
        <p className="text-xs text-zinc-600">
          {[item.setName, item.language, item.location?.code].filter(Boolean).join(' · ')}
        </p>
      </div>
      <style>{`@page { size: 62mm 29mm; margin: 4mm; }`}</style>
    </div>
  );
}
