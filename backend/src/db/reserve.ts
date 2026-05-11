import { type Reservation } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  InsufficientStockError,
  NotFoundError,
} from "../lib/errors";

type InventoryRow = {
  totalQuantity: number;
  reservedQuantity: number;
};

export async function createReservation(
  productId: string,
  warehouseId: string,
  units: number
): Promise<Reservation> {
  return prisma.$transaction(async (tx) => {
    // Acquire a row-level exclusive lock on the inventory row for this SKU.
    // Every concurrent request for the same (productId, warehouseId) pair will
    // queue here — only one runs at a time. This is what prevents double-spend.
    const rows = await tx.$queryRaw<InventoryRow[]>`
      SELECT "totalQuantity", "reservedQuantity"
      FROM "Inventory"
      WHERE "productId" = ${productId}
        AND "warehouseId" = ${warehouseId}
      FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new NotFoundError("No inventory found for this product and warehouse");
    }

    const inv = rows[0];
    const available = inv.totalQuantity - inv.reservedQuantity;

    if (available < units) {
      throw new InsufficientStockError(
        `Only ${available} unit${available === 1 ? "" : "s"} available`
      );
    }

    await tx.inventory.update({
      where: { productId_warehouseId: { productId, warehouseId } },
      data: { reservedQuantity: { increment: units } },
    });

    const expiresAt = new Date(
      Date.now() + Number(process.env.RESERVATION_TTL_MINUTES ?? 10) * 60 * 1000
    );

    const reservation = await tx.reservation.create({
      data: { productId, warehouseId, units, status: "PENDING", expiresAt },
    });

    return reservation;
  });
}
