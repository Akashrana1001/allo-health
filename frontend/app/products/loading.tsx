import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <main className="container py-8 max-w-6xl">
      <div className="mb-10">
        <Skeleton className="h-5 w-28 rounded-full mb-3" />
        <Skeleton className="h-10 w-72 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-white overflow-hidden shadow-sm">
            <Skeleton className="h-52 w-full rounded-none" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl mt-1" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
