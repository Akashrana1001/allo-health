import { apiFetch } from "@/lib/api";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/schemas";

// Always render at request time so stock levels are fresh and build
// doesn't fail when the backend isn't reachable from Vercel's build machines.
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await apiFetch<Product[]>("/api/products", {
    cache: "no-store",
  });

  return (
    <main className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Products</h1>
        <p className="text-muted-foreground mt-1">
          Browse stock across our warehouses and reserve what you need.
        </p>
      </div>

      {products.length === 0 ? (
        <p className="text-center text-muted-foreground py-20">
          No products available right now.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}
