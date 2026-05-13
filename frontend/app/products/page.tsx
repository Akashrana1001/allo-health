import { ProductsGrid } from "@/components/products-grid";
import { apiFetch } from "@/lib/api";
import type { Product } from "@/lib/schemas";

export const revalidate = 15;

async function getInitialProducts(): Promise<Product[] | undefined> {
  try {
    return await apiFetch<Product[]>("/api/products", {
      next: { revalidate },
    });
  } catch (error) {
    console.error("[products] initial fetch failed", error);
    return undefined;
  }
}

export default async function ProductsPage() {
  const initialProducts = await getInitialProducts();

  return (
    <main className="container py-8 max-w-6xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Live Inventory
        </div>
        <h1 className="text-4xl font-bold text-slate-900 leading-tight">
          Reserve Before It&apos;s Gone
        </h1>
        <p className="text-slate-500 mt-2 max-w-xl">
          Stock is held for 10 minutes once you reserve — confirm your purchase before the timer runs out.
        </p>
      </div>

      <ProductsGrid initialProducts={initialProducts} />
    </main>
  );
}
