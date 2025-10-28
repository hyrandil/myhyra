import { NextRequest, NextResponse } from 'next/server';
import JsBarcode from 'jsbarcode';
import { createCanvas } from '@napi-rs/canvas';
import { z } from 'zod';
import { Game } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { generateItemCode } from '@/lib/code';
import { getDefaultUser } from '@/lib/users';

export const runtime = 'nodejs';

const itemInputSchema = z.object({
  name: z.string().min(1),
  game: z.nativeEnum(Game),
  setName: z.string().optional(),
  number: z.string().optional(),
  language: z.string().optional(),
  condition: z.string().optional(),
  priceCents: z.union([z.string(), z.number()]).optional(),
  locationCode: z.string().optional(),
});

function cleanOptional(value: string | number | undefined | null) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    return undefined;
  }
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = itemInputSchema.parse(body);

    const user = await getDefaultUser();
    const locationCode = cleanOptional(parsed.locationCode) as string | undefined;
    let locationId: string | undefined;

    if (locationCode) {
      const location = await prisma.location.upsert({
        where: { code: locationCode },
        update: {},
        create: { code: locationCode },
      });
      locationId = location.id;
    }

    const priceValueRaw = cleanOptional(parsed.priceCents);
    const priceValue =
      typeof priceValueRaw === 'string'
        ? Number.parseInt(priceValueRaw, 10)
        : typeof priceValueRaw === 'number'
          ? Math.round(priceValueRaw)
          : undefined;

    const code = generateItemCode();

    const item = await prisma.item.create({
      data: {
        itemCode: code,
        name: parsed.name,
        game: parsed.game,
        setName: cleanOptional(parsed.setName) as string | undefined,
        number: cleanOptional(parsed.number) as string | undefined,
        language: cleanOptional(parsed.language) as string | undefined,
        condition: cleanOptional(parsed.condition) as string | undefined,
        priceCents: Number.isFinite(priceValue) ? priceValue : undefined,
        locationId,
        userId: user.id,
      },
      include: {
        location: true,
      },
    });

    const canvas = createCanvas(320, 120);
    JsBarcode(canvas as unknown as HTMLCanvasElement, code, {
      format: 'CODE128',
      displayValue: true,
      fontSize: 14,
      margin: 4,
    });

    const barcodePngDataUrl = canvas.toDataURL('image/png');

    return NextResponse.json({ item, barcodePngDataUrl });
  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}
