import { ProductsGrid } from "@/components/products-grid";

export const dynamic = "force-dynamic";

export default function ProductsPage() {
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

      <ProductsGrid />
    </main>
  );
}
