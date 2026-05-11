import { Router } from "express";
import { prisma } from "../lib/prisma";
import { validate } from "../middleware/validate";
import { CreateReservationSchema } from "../lib/schemas";
import { createReservation } from "../db/reserve";
import {
  NotFoundError,
  ReservationExpiredError,
  AlreadyConfirmedError,
  AlreadyReleasedError,
} from "../lib/errors";

const router = Router();

// POST /api/reservations
router.post("/", validate(CreateReservationSchema), async (req, res, next) => {
  try {
    const { productId, warehouseId, units } = req.body as {
      productId: string;
      warehouseId: string;
      units: number;
    };

    const reservation = await createReservation(productId, warehouseId, units);

    res.status(201).json(serializeReservation(reservation));
  } catch (err) {
    next(err);
  }
});

// GET /api/reservations/:id
router.get("/:id", async (req, res, next) => {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      include: {
        product: { select: { id: true, name: true, price: true, imageUrl: true } },
        warehouse: { select: { id: true, name: true, location: true } },
      },
    });

    if (!reservation) throw new NotFoundError("Reservation not found");

    res.json({
      ...serializeReservation(reservation),
      product: reservation.product
        ? { ...reservation.product, price: reservation.product.price.toString() }
        : undefined,
      warehouse: reservation.warehouse ?? undefined,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/reservations/:id/confirm
router.post("/:id/confirm", async (req, res, next) => {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: req.params.id },
    });

    if (!reservation) throw new NotFoundError("Reservation not found");
    if (reservation.status === "CONFIRMED") throw new AlreadyConfirmedError();
    if (reservation.status === "RELEASED") throw new ReservationExpiredError("Reservation was cancelled");
    if (reservation.expiresAt <= new Date()) throw new ReservationExpiredError();

    const updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

    res.json(serializeReservation(updated));
  } catch (err) {
    next(err);
  }
});

// POST /api/reservations/:id/release
router.post("/:id/release", async (req, res, next) => {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: req.params.id },
    });

    if (!reservation) throw new NotFoundError("Reservation not found");

    // Natural idempotency: releasing an already-released reservation is harmless
    if (reservation.status === "RELEASED") {
      res.json(serializeReservation(reservation));
      return;
    }

    if (reservation.status === "CONFIRMED") {
      throw new AlreadyConfirmedError("Cannot release a confirmed reservation");
    }

    // PENDING → RELEASED: return units to inventory in the same transaction
    const updated = await prisma.$transaction(async (tx) => {
      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reservedQuantity: { decrement: reservation.units } },
      });

      return tx.reservation.update({
        where: { id: reservation.id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
    });

    res.json(serializeReservation(updated));
  } catch (err) {
    next(err);
  }
});

function serializeReservation(r: {
  id: string;
  productId: string;
  warehouseId: string;
  units: number;
  status: string;
  expiresAt: Date;
  confirmedAt: Date | null;
  releasedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: r.id,
    productId: r.productId,
    warehouseId: r.warehouseId,
    units: r.units,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    releasedAt: r.releasedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export default router;
