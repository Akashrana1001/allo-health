"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountdownTimer } from "@/components/countdown-timer";
import { apiFetch, ApiException } from "@/lib/api";
import type { ReservationResponse } from "@/lib/schemas";

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
      toast.success("Purchase confirmed!");
    },
    onError: (err) => {
      if (err instanceof ApiException && err.status === 410) {
        toast.error("This reservation expired before it could be confirmed.");
        setExpired(true);
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
      <main className="container py-16 text-center">
        <XCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-semibold">Reservation not found</h1>
        <Button className="mt-4" onClick={() => router.push("/products")}>
          Back to products
        </Button>
      </main>
    );
  }

  const isExpired =
    expired ||
    reservation.status === "RELEASED" ||
    new Date(reservation.expiresAt) <= new Date();
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";

  return (
    <main className="container py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Your Reservation</h1>

      {/* Expired banner */}
      {isExpired && !isConfirmed && (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">This reservation has expired. The units have been released.</span>
        </div>
      )}

      {/* Confirmed banner */}
      {isConfirmed && (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-green-500/50 bg-green-50 p-4 text-green-800">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">Purchase confirmed! Thank you for your order.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left — Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Product" value={reservation.product?.name ?? reservation.productId} />
            <Row label="Warehouse" value={reservation.warehouse?.name ?? reservation.warehouseId} />
            <Row label="Location" value={reservation.warehouse?.location ?? "—"} />
            <Row label="Units" value={String(reservation.units)} />
            {reservation.product?.price && (
              <Row
                label="Unit price"
                value={`₹${Number(reservation.product.price).toLocaleString("en-IN")}`}
              />
            )}
            <hr />
            <Row
              label="Total"
              value={
                reservation.product?.price
                  ? `₹${(reservation.units * Number(reservation.product.price)).toLocaleString("en-IN")}`
                  : "—"
              }
              bold
            />
            <Row label="Status" value={reservation.status} />
          </CardContent>
        </Card>

        {/* Right — Timer + Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {isConfirmed ? "Completed" : isReleased ? "Cancelled" : "Time Remaining"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isConfirmed && !isReleased && (
              <CountdownTimer
                expiresAt={reservation.expiresAt}
                totalMs={TTL_MS}
                onExpire={() => setExpired(true)}
              />
            )}

            {!isConfirmed && !isReleased && (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => confirmMutation.mutate()}
                  disabled={isMutating || isExpired}
                  className="w-full"
                >
                  {confirmMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirm Purchase
                </Button>
                <Button
                  variant="outline"
                  onClick={() => releaseMutation.mutate()}
                  disabled={isMutating}
                  className="w-full"
                >
                  {releaseMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cancel Reservation
                </Button>
              </div>
            )}

            {(isConfirmed || isReleased) && (
              <Button variant="outline" className="w-full" onClick={() => router.push("/products")}>
                Back to Products
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

function ReservationSkeleton() {
  return (
    <main className="container py-8 max-w-4xl">
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card><CardContent className="p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </CardContent></Card>
        <Card><CardContent className="p-6 space-y-4">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent></Card>
      </div>
    </main>
  );
}
