import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const products: { name: string; description: string; imageUrl: string; price: number }[] = [
  {
    name: "Running Shoes X1",
    description: "Lightweight daily trainer with responsive cushioning.",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600",
    price: 4999,
  },
  {
    name: "Yoga Mat Pro",
    description: "Non-slip 6mm mat with alignment lines, ideal for all styles.",
    imageUrl: "https://images.unsplash.com/photo-1601925228104-ad4bd1bc3dc2?w=600",
    price: 1299,
  },
  {
    name: "Resistance Band Set",
    description: "Set of 5 latex bands with progressive resistance levels.",
    imageUrl: "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=600",
    price: 699,
  },
  {
    name: "Foam Roller",
    description: "High-density EVA foam roller for post-workout recovery.",
    imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600",
    price: 999,
  },
  {
    name: "Gym Gloves",
    description: "Full-palm protection with wrist support for heavy lifts.",
    imageUrl: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600",
    price: 499,
  },
  {
    name: "Adjustable Dumbbell",
    description: "Single 5–25 kg adjustable dumbbell. Very limited stock.",
    imageUrl: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600",
    price: 8999,
  },
];

const warehouses: { name: string; location: string }[] = [
  { name: "Mumbai Central", location: "Mumbai, MH" },
  { name: "Delhi Hub", location: "Delhi, DL" },
  { name: "Bangalore Depot", location: "Bangalore, KA" },
];

// [productIndex, warehouseIndex, totalQuantity]
// Products "Gym Gloves" (idx 4) and "Adjustable Dumbbell" (idx 5) have
// totalQuantity = 1 in one warehouse each — use them to demo 409.
const inventoryLayout: [number, number, number][] = [
  [0, 0, 25], [0, 1, 18], [0, 2, 10], // Running Shoes
  [1, 0, 40], [1, 1,  0], [1, 2, 15], // Yoga Mat (Delhi out of stock)
  [2, 0,  8], [2, 1, 12], [2, 2,  5], // Resistance Bands
  [3, 0,  0], [3, 1, 20], [3, 2,  3], // Foam Roller (Mumbai out of stock)
  [4, 0,  1], [4, 1,  4], [4, 2,  2], // Gym Gloves — Mumbai has 1 unit (409 demo)
  [5, 0,  0], [5, 1,  1], [5, 2,  0], // Adjustable Dumbbell — Delhi has 1 unit (409 demo)
];

async function upsertByName<T extends { id: string }>(
  findFirst: () => Promise<T | null>,
  create: () => Promise<T>,
  update: (id: string) => Promise<T>
): Promise<T> {
  const existing = await findFirst();
  if (existing) return update(existing.id);
  return create();
}

async function main() {
  console.log("Seeding database...");

  const warehouseRecords: { id: string }[] = [];
  for (const w of warehouses) {
    const record = await upsertByName(
      () => prisma.warehouse.findFirst({ where: { name: w.name } }),
      () => prisma.warehouse.create({ data: w }),
      (id) => prisma.warehouse.update({ where: { id }, data: w })
    );
    warehouseRecords.push(record);
  }

  const productRecords: { id: string }[] = [];
  for (const p of products) {
    const record = await upsertByName(
      () => prisma.product.findFirst({ where: { name: p.name } }),
      () => prisma.product.create({ data: p as Prisma.ProductCreateInput }),
      (id) => prisma.product.update({ where: { id }, data: p as Prisma.ProductUpdateInput })
    );
    productRecords.push(record);
  }

  for (const [pi, wi, totalQuantity] of inventoryLayout) {
    const productId = productRecords[pi].id;
    const warehouseId = warehouseRecords[wi].id;
    await prisma.inventory.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      update: { totalQuantity },
      create: { productId, warehouseId, totalQuantity, reservedQuantity: 0 },
    });
  }

  console.log(`✓ ${productRecords.length} products, ${warehouseRecords.length} warehouses seeded.`);
  console.log("  Low-stock demo items:");
  console.log("    • Gym Gloves @ Mumbai Central — 1 unit");
  console.log("    • Adjustable Dumbbell @ Delhi Hub — 1 unit");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
