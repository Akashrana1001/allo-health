"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReserveModal } from "./reserve-modal";
import type { Product } from "@/lib/schemas";
import { MapPin, ShoppingBag } from "lucide-react";

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0)
    return <Badge variant="danger" className="text-[10px] px-1.5 py-0">Out of Stock</Badge>;
  if (qty <= 5)
    return <Badge variant="warning" className="text-[10px] px-1.5 py-0">Low: {qty}</Badge>;
  return <Badge variant="success" className="text-[10px] px-1.5 py-0">{qty} left</Badge>;
}

export function ProductCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const totalAvailable = product.inventory.reduce(
    (sum, inv) => sum + inv.availableQuantity,
    0
  );

  const isOutOfStock = totalAvailable === 0;

  return (
    <>
      <div className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
        {/* Image */}
        <div className="relative h-52 w-full bg-slate-100 overflow-hidden">
          {product.imageUrl && !imgError ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <ShoppingBag className="h-12 w-12 text-slate-300" />
            </div>
          )}

          {/* Out of stock overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
              <span className="text-sm font-semibold text-slate-500 bg-white px-3 py-1 rounded-full border">
                Out of Stock
              </span>
            </div>
          )}

          {/* Price pill */}
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-sm font-bold text-slate-800 shadow-sm">
            ₹{Number(product.price).toLocaleString("en-IN")}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-4 gap-3">
          <div>
            <h3 className="font-semibold text-slate-900 leading-snug">{product.name}</h3>
            {product.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{product.description}</p>
            )}
          </div>

          {/* Warehouse stock */}
          <div className="flex flex-col gap-1.5">
            {product.inventory.map((inv) => (
              <div key={inv.warehouseId} className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3 w-3" />
                  {inv.warehouseName}
                </span>
                <StockBadge qty={inv.availableQuantity} />
              </div>
            ))}
          </div>

          {/* Reserve button */}
          <Button
            className="mt-auto w-full rounded-xl font-semibold"
            disabled={isOutOfStock}
            variant={isOutOfStock ? "outline" : "default"}
            onClick={() => setOpen(true)}
          >
            {isOutOfStock ? "Unavailable" : "Reserve Now"}
          </Button>
        </div>
      </div>

      <ReserveModal product={product} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
