import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        inventory: {
          include: { warehouse: true },
        },
      },
    });

    const now = new Date();

    // For each inventory row compute availableQuantity by subtracting only
    // PENDING reservations that haven't expired yet. This is the lazy-cleanup
    // layer: availability is always accurate even if the cron hasn't run.
    const result = await Promise.all(
      products.map(async (product) => {
        const inventoryWithAvailable = await Promise.all(
          product.inventory.map(async (inv) => {
            const activeReserved = await prisma.reservation.aggregate({
              _sum: { units: true },
              where: {
                productId: product.id,
                warehouseId: inv.warehouseId,
                status: "PENDING",
                expiresAt: { gt: now },
              },
            });

            const effectiveReserved = activeReserved._sum.units ?? 0;
            const availableQuantity = Math.max(
              0,
              inv.totalQuantity - effectiveReserved
            );

            return {
              id: inv.id,
              warehouseId: inv.warehouseId,
              warehouseName: inv.warehouse.name,
              warehouseLocation: inv.warehouse.location,
              totalQuantity: inv.totalQuantity,
              reservedQuantity: effectiveReserved,
              availableQuantity,
            };
          })
        );

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          price: product.price.toString(),
          createdAt: product.createdAt.toISOString(),
          inventory: inventoryWithAvailable,
        };
      })
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
