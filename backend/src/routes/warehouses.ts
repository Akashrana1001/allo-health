import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, location: true },
    });
    res.json(warehouses);
  } catch (err) {
    next(err);
  }
});

export default router;
