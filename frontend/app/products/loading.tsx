import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <main className="container py-8">
      <div className="mb-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card overflow-hidden">
            <Skeleton className="h-48 w-full rounded-none" />
            <div className="p-6 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full mt-2" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
