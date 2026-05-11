import { z } from "zod";

// ── Request schemas (mirrors backend/src/lib/schemas.ts) ──────────────────

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  warehouseId: z.string().min(1, "Please select a warehouse"),
  units: z
    .number({ invalid_type_error: "Units must be a number" })
    .int()
    .min(1, "At least 1 unit required")
    .max(1000),
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

export type InventoryItem = z.infer<typeof InventorySchema>;

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  price: z.string(),
  createdAt: z.string().datetime(),
  inventory: z.array(InventorySchema),
});

export type Product = z.infer<typeof ProductSchema>;

export const WarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
});

export type Warehouse = z.infer<typeof WarehouseSchema>;
