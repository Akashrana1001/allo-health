"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, MapPin, Package, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CountdownTimer } from "@/components/countdown-timer";
import { apiFetch, ApiException } from "@/lib/api";
import type { ReservationResponse } from "@/lib/schemas";
import Link from "next/link";

const TTL_MS = 10 * 60 * 1000;

export default function ReservationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [expired, setExpired] = useState(false);

  const { data: reservation, isLoading, error } = useQuery<ReservationResponse>({
    queryKey: ["reservation", id],
    queryFn: () => apiFetch<ReservationResponse>(`/api/reservations/${id}`),
    refetchInterval: 5000,
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      apiFetch<ReservationResponse>(`/api/reservations/${id}/confirm`, { method: "POST" }),
    onSuccess: (data) => {
      qc.setQueryData(["reservation", id], data);
      toast.success("Purchase confirmed! Thank you.");
    },
    onError: (err) => {
      if (err instanceof ApiException && err.status === 410) {
        setExpired(true);
        toast.error("This reservation expired before it could be confirmed.");
      } else {
        toast.error((err as Error).message ?? "Something went wrong");
      }
    },
  });

  const releaseMutation = useMutation({
    mutationFn: () =>
      apiFetch<ReservationResponse>(`/api/reservations/${id}/release`, { method: "POST" }),
    onSuccess: () => {
      toast.info("Reservation cancelled.");
      setTimeout(() => router.push("/products"), 1500);
    },
    onError: (err) => {
      toast.error((err as Error).message ?? "Something went wrong");
    },
  });

  const isMutating = confirmMutation.isPending || releaseMutation.isPending;

  if (isLoading) return <ReservationSkeleton />;

  if (error || !reservation) {
    return (
      <main className="container py-16 text-center max-w-md mx-auto">
        <div className="rounded-2xl border bg-white p-10 shadow-sm">
          <XCircle className="mx-auto h-14 w-14 text-destructive mb-4" />
          <h1 className="text-xl font-semibold">Reservation not found</h1>
          <p className="text-muted-foreground text-sm mt-1 mb-6">
            This reservation may have expired or doesn&apos;t exist.
          </p>
          <Button asChild className="rounded-xl">
            <Link href="/products">Back to products</Link>
          </Button>
        </div>
      </main>
    );
  }

  const isExpired =
    expired ||
    reservation.status === "RELEASED" ||
    new Date(reservation.expiresAt) <= new Date();
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";
  const isPending = reservation.status === "PENDING";

  const totalPrice = reservation.product?.price
    ? reservation.units * Number(reservation.product.price)
    : null;

  return (
    <main className="container py-8 max-w-4xl">
      {/* Back link */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to products
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">Your Reservation</h1>

      {/* Status banners */}
      {isConfirmed && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
          <div>
            <p className="font-semibold">Purchase confirmed!</p>
            <p className="text-sm text-green-700">Your order has been placed. Stock updated.</p>
          </div>
        </div>
      )}

      {isReleased && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
          <XCircle className="h-5 w-5 flex-shrink-0 text-slate-400" />
          <div>
            <p className="font-semibold">Reservation cancelled</p>
            <p className="text-sm text-slate-500">Stock has been returned to available inventory.</p>
          </div>
        </div>
      )}

      {isPending && isExpired && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <Clock className="h-5 w-5 flex-shrink-0 text-red-500" />
          <div>
            <p className="font-semibold">Reservation expired</p>
            <p className="text-sm text-red-600">The hold has been released. Stock is available again.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Left — Summary (3 cols) */}
        <div className="md:col-span-3 rounded-2xl border bg-white shadow-sm p-6 space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Product</p>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  {reservation.product?.name ?? reservation.productId}
                </p>
                {reservation.warehouse && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {reservation.warehouse.name} · {reservation.warehouse.location}
                  </p>
                )}
              </div>
            </div>
          </div>

          <hr className="border-slate-100" />

          <div className="grid grid-cols-2 gap-4">
            <Stat label="Units reserved" value={String(reservation.units)} />
            {reservation.product?.price && (
              <Stat
                label="Unit price"
                value={`₹${Number(reservation.product.price).toLocaleString("en-IN")}`}
              />
            )}
            <Stat
              label="Status"
              value={reservation.status}
              valueClass={
                isConfirmed ? "text-green-600" :
                isReleased ? "text-slate-500" :
                isExpired ? "text-red-600" :
                "text-blue-600"
              }
            />
            <Stat
              label="Reserved at"
              value={new Date(reservation.createdAt).toLocaleTimeString("en-IN", {
                hour: "2-digit", minute: "2-digit"
              })}
            />
          </div>

          {totalPrice !== null && (
            <>
              <hr className="border-slate-100" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total amount</span>
                <span className="text-2xl font-bold text-slate-900">
                  ₹{totalPrice.toLocaleString("en-IN")}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right — Timer + Actions (2 cols) */}
        <div className="md:col-span-2 rounded-2xl border bg-white shadow-sm p-6 flex flex-col gap-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              {isConfirmed ? "Order status" : isReleased ? "Reservation ended" : "Time remaining"}
            </p>

            {isPending && !isExpired ? (
              <CountdownTimer
                expiresAt={reservation.expiresAt}
                totalMs={TTL_MS}
                onExpire={() => setExpired(true)}
              />
            ) : isConfirmed ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-8 w-8" />
                <span className="font-semibold text-lg">Confirmed</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <XCircle className="h-8 w-8" />
                <span className="font-semibold text-lg">Ended</span>
              </div>
            )}
          </div>

          {isPending && !isConfirmed && !isReleased && (
            <div className="flex flex-col gap-2 mt-auto">
              <Button
                onClick={() => confirmMutation.mutate()}
                disabled={isMutating || isExpired}
                className="w-full rounded-xl h-11 font-semibold text-base"
              >
                {confirmMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming…</>
                  : "Confirm Purchase"
                }
              </Button>
              <Button
                variant="outline"
                onClick={() => releaseMutation.mutate()}
                disabled={isMutating}
                className="w-full rounded-xl h-11"
              >
                {releaseMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Cancelling…</>
                  : "Cancel Reservation"
                }
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-1">
                Cancelling returns units to available stock immediately.
              </p>
            </div>
          )}

          {(isConfirmed || isReleased || (isExpired && !isPending)) && (
            <Button
              variant="outline"
              className="mt-auto w-full rounded-xl"
              onClick={() => router.push("/products")}
            >
              Browse more products
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`font-semibold text-slate-900 ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}

function ReservationSkeleton() {
  return (
    <main className="container py-8 max-w-4xl">
      <Skeleton className="h-4 w-28 mb-6" />
      <Skeleton className="h-8 w-56 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-3 rounded-2xl border bg-white p-6 space-y-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-px w-full" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </div>
        <div className="md:col-span-2 rounded-2xl border bg-white p-6 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </main>
  );
}
