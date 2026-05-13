import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const now = new Date();
    const [products, activeReservations] = await Promise.all([
      prisma.product.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          inventory: {
            include: { warehouse: true },
          },
        },
      }),
      prisma.reservation.groupBy({
        by: ["productId", "warehouseId"],
        where: {
          status: "PENDING",
          expiresAt: { gt: now },
        },
        _sum: { units: true },
      }),
    ]);

    const reservedByInventoryKey = new Map<string, number>();
    for (const row of activeReservations) {
      reservedByInventoryKey.set(
        `${row.productId}::${row.warehouseId}`,
        row._sum.units ?? 0
      );
    }

    // For each inventory row compute availableQuantity by subtracting only
    // PENDING reservations that haven't expired yet. This is the lazy-cleanup
    // layer: availability is always accurate even if the cron hasn't run.
    const result = products.map((product) => {
      const inventoryWithAvailable = product.inventory.map((inv) => {
        const effectiveReserved =
          reservedByInventoryKey.get(`${product.id}::${inv.warehouseId}`) ?? 0;
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
      });

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        price: product.price.toString(),
        createdAt: product.createdAt.toISOString(),
        inventory: inventoryWithAvailable,
      };
    });

    res.setHeader(
      "Cache-Control",
      "public, max-age=5, s-maxage=10, stale-while-revalidate=30"
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
