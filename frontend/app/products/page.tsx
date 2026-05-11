import { apiFetch } from "@/lib/api";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/schemas";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let products: Product[] = [];
  let error: string | null = null;

  try {
    products = await apiFetch<Product[]>("/api/products", { cache: "no-store" });
  } catch {
    error = "Could not load products. Make sure the backend is running.";
  }

  return (
    <main className="container py-8 max-w-6xl">
      {/* Hero */}
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

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
          {error}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <Package className="h-12 w-12 mb-3" />
          <p className="font-medium">No products available</p>
        </div>
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
