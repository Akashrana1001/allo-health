"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiFetch, ApiException } from "@/lib/api";
import type { Product, ReservationResponse } from "@/lib/schemas";

const FormSchema = z.object({
  warehouseId: z.string().min(1, "Please select a warehouse"),
  units: z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .int()
    .min(1, "At least 1 unit"),
});

type FormValues = z.infer<typeof FormSchema>;

interface ReserveModalProps {
  product: Product;
  open: boolean;
  onClose: () => void;
}

export function ReserveModal({ product, open, onClose }: ReserveModalProps) {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  const stockWarehouses = product.inventory.filter((inv) => inv.availableQuantity > 0);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { warehouseId: "", units: 1 },
  });

  const selectedWarehouseId = watch("warehouseId");
  const selectedWarehouse = product.inventory.find(
    (inv) => inv.warehouseId === selectedWarehouseId
  );
  const maxUnits = selectedWarehouse?.availableQuantity ?? 999;

  async function onSubmit(data: FormValues) {
    setApiError(null);
    try {
      const reservation = await apiFetch<ReservationResponse>("/api/reservations", {
        method: "POST",
        body: { productId: product.id, warehouseId: data.warehouseId, units: data.units },
      });
      reset();
      onClose();
      router.push(`/reservations/${reservation.id}`);
    } catch (err) {
      if (err instanceof ApiException) {
        if (err.status === 409) {
          const msg = "Not enough stock — someone just grabbed the last unit.";
          toast.error(msg);
          setApiError(msg);
        } else {
          setApiError(err.message);
        }
      } else {
        setApiError("Something went wrong. Please try again.");
      }
    }
  }

  function handleClose() {
    reset();
    setApiError(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reserve {product.name}</DialogTitle>
          <DialogDescription>
            ₹{Number(product.price).toLocaleString("en-IN")} · Select a warehouse and quantity.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="warehouse">Warehouse</Label>
            {stockWarehouses.length === 0 ? (
              <p className="text-sm text-destructive">No stock available in any warehouse.</p>
            ) : (
              <Select
                value={selectedWarehouseId}
                onValueChange={(val) => setValue("warehouseId", val, { shouldValidate: true })}
              >
                <SelectTrigger id="warehouse">
                  <SelectValue placeholder="Choose a warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {stockWarehouses.map((inv) => (
                    <SelectItem key={inv.warehouseId} value={inv.warehouseId}>
                      {inv.warehouseName} — {inv.availableQuantity} available
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.warehouseId && (
              <p className="text-xs text-destructive">{errors.warehouseId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="units">Quantity</Label>
            <Input
              id="units"
              type="number"
              min={1}
              max={maxUnits}
              {...register("units", { valueAsNumber: true })}
            />
            {errors.units && (
              <p className="text-xs text-destructive">{errors.units.message}</p>
            )}
            {selectedWarehouse && (
              <p className="text-xs text-muted-foreground">
                Max available: {selectedWarehouse.availableQuantity}
              </p>
            )}
          </div>

          {apiError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {apiError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || stockWarehouses.length === 0}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Reserve
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
