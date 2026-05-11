import { z } from "zod";

// ── Request schemas ────────────────────────────────────────────────────────

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  warehouseId: z.string().min(1, "warehouseId is required"),
  units: z.number().int().min(1, "units must be at least 1").max(1000),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

// ── Response schemas ───────────────────────────────────────────────────────

export const ReservationStatusSchema = z.enum(["PENDING", "CONFIRMED", "RELEASED"]);

export const ReservationSchema = z.object({
  id: z.string(),
  productId: z.string(),
  warehouseId: z.string(),
  units: z.number(),
  status: ReservationStatusSchema,
  expiresAt: z.string().datetime(),
  confirmedAt: z.string().datetime().nullable(),
  releasedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  product: z
    .object({
      id: z.string(),
      name: z.string(),
      price: z.string(),
      imageUrl: z.string().nullable(),
    })
    .optional(),
  warehouse: z
    .object({
      id: z.string(),
      name: z.string(),
      location: z.string(),
    })
    .optional(),
});

export type ReservationResponse = z.infer<typeof ReservationSchema>;

export const InventorySchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  warehouseName: z.string(),
  warehouseLocation: z.string(),
  totalQuantity: z.number(),
  reservedQuantity: z.number(),
  availableQuantity: z.number(),
});

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  price: z.string(),
  createdAt: z.string().datetime(),
  inventory: z.array(InventorySchema),
});

export const WarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
});

export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});
