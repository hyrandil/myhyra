import { NextRequest, NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';

import { prisma } from '@/lib/prisma';
import { getDefaultUser } from '@/lib/users';

export const runtime = 'nodejs';

const ORDER_NO_RX = /(Order|Bestell(?:ung)?)[^\d]*(\d{6,})/i;
const CODE_RX = /\bC-[A-Z0-9]+-[A-Z0-9]{2}\b/g;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'PDF file is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    const orderMatch = text.match(ORDER_NO_RX);
    if (!orderMatch) {
      return NextResponse.json({ error: 'Order number not found in PDF' }, { status: 400 });
    }

    const marketplaceId = orderMatch[2];
    const codeMatches = text.match(CODE_RX) ?? [];

    const counts = new Map<string, number>();
    for (const code of codeMatches) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }

    const user = await getDefaultUser();

    const items = await prisma.item.findMany({
      where: { itemCode: { in: Array.from(counts.keys()) } },
      include: { location: true },
    });

    const orderLines = items.map((item) => ({
      itemId: item.id,
      quantity: counts.get(item.itemCode) ?? 1,
    }));

    let order = await prisma.order.findUnique({
      where: { marketplaceId },
      include: {
        lines: {
          include: {
            item: { include: { location: true } },
          },
        },
      },
    });

    if (!order) {
      order = await prisma.order.create({
        data: {
          marketplaceId,
          userId: user.id,
          lines: {
            create: orderLines,
          },
        },
        include: {
          lines: {
            include: {
              item: { include: { location: true } },
            },
          },
        },
      });
    } else {
      await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
      order = await prisma.order.update({
        where: { id: order.id },
        data: {
          lines: {
            create: orderLines,
          },
        },
        include: {
          lines: {
            include: {
              item: { include: { location: true } },
            },
          },
        },
      });
    }

    const responsePayload = {
      ok: true,
      order,
      matchedItems: items,
      unmatchedCodes: Array.from(counts.keys()).filter(
        (code) => !items.find((item) => item.itemCode === code),
      ),
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to import order' }, { status: 500 });
  }
}
