"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { ProductCard } from "./product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Package, RefreshCw } from "lucide-react";
import type { Product } from "@/lib/schemas";

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border bg-white overflow-hidden shadow-sm">
          <Skeleton className="h-52 w-full rounded-none" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <div className="space-y-2 pt-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ProductsGridProps {
  initialProducts?: Product[];
}

export function ProductsGrid({ initialProducts }: ProductsGridProps) {
  const { data: products, isLoading, isError, refetch, isFetching } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiFetch<Product[]>("/api/products"),
    initialData: initialProducts,
    staleTime: 30_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  if (isLoading) return <LoadingSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-2xl border bg-white shadow-sm p-10 max-w-sm w-full">
          <Package className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h2 className="font-semibold text-slate-700 mb-1">Could not load products</h2>
          <p className="text-sm text-slate-500 mb-6">
            The server may be waking up. Please try again in a moment.
          </p>
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-xl w-full"
          >
            {isFetching
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Retrying…</>
              : <><RefreshCw className="h-4 w-4" /> Try again</>
            }
          </Button>
        </div>
      </div>
    );
  }

  if (!products?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Package className="h-12 w-12 mb-3" />
        <p className="font-medium">No products available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} priority={i < 3} />
      ))}
    </div>
  );
}
