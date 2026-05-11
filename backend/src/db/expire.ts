import { prisma } from "../lib/prisma";

export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  // Find all expired PENDING reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      productId: true,
      warehouseId: true,
      units: true,
    },
  });

  if (expired.length === 0) return 0;

  // Group units to return per inventory row
  const inventoryDeltas = new Map<string, { productId: string; warehouseId: string; units: number }>();
  for (const r of expired) {
    const key = `${r.productId}::${r.warehouseId}`;
    const existing = inventoryDeltas.get(key);
    if (existing) {
      existing.units += r.units;
    } else {
      inventoryDeltas.set(key, { productId: r.productId, warehouseId: r.warehouseId, units: r.units });
    }
  }

  // Decrement inventory and mark reservations RELEASED in a single transaction
  await prisma.$transaction(async (tx) => {
    for (const { productId, warehouseId, units } of inventoryDeltas.values()) {
      await tx.inventory.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { reservedQuantity: { decrement: units } },
      });
    }

    await tx.reservation.updateMany({
      where: {
        id: { in: expired.map((r) => r.id) },
        status: "PENDING",
      },
      data: { status: "RELEASED", releasedAt: now },
    });
  });

  return expired.length;
}
