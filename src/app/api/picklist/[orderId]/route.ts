import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            item: {
              include: {
                location: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const sortedLines = order.lines
      .map((line) => ({
        ...line,
        locationCode: line.item?.location?.code ?? 'ZZZ',
      }))
      .sort((a, b) => a.locationCode.localeCompare(b.locationCode, undefined, { numeric: true }));

    return NextResponse.json({ ok: true, lines: sortedLines });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load picklist' }, { status: 500 });
  }
}
