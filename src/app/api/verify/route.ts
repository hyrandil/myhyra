import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const verifySchema = z.object({
  code: z.string().min(1),
  orderId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verifySchema.parse(body);

    const item = await prisma.item.findFirst({
      where: { itemCode: parsed.code },
      include: { location: true },
    });

    await prisma.scanLog.create({
      data: {
        code: parsed.code,
        context: parsed.orderId ? 'PICK' : 'VERIFY',
        orderId: parsed.orderId ?? null,
      },
    });

    if (!item) {
      return NextResponse.json({ ok: false });
    }

    if (parsed.orderId) {
      await prisma.orderLine.updateMany({
        where: { orderId: parsed.orderId, itemId: item.id },
        data: { note: 'SCANNED' },
      });
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
  }
}
