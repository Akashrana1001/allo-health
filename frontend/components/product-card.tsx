"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReserveModal } from "./reserve-modal";
import type { Product } from "@/lib/schemas";
import { MapPin, Dumbbell, Footprints, Layers, Wind, Hand, CircleDot } from "lucide-react";

// Deterministic gradient + icon per product so something beautiful shows instantly
const THEMES = [
  { gradient: "from-blue-400 to-indigo-600",    Icon: Footprints  },
  { gradient: "from-purple-400 to-pink-600",     Icon: Layers      },
  { gradient: "from-emerald-400 to-teal-600",    Icon: Wind        },
  { gradient: "from-orange-400 to-red-500",      Icon: CircleDot   },
  { gradient: "from-amber-400 to-orange-500",    Icon: Hand        },
  { gradient: "from-slate-500 to-blue-700",      Icon: Dumbbell    },
];

function getTheme(name: string) {
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % THEMES.length;
  return THEMES[idx];
}

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0)
    return <Badge variant="danger"  className="text-[10px] px-1.5 py-0">Out of Stock</Badge>;
  if (qty <= 5)
    return <Badge variant="warning" className="text-[10px] px-1.5 py-0">Low: {qty}</Badge>;
  return   <Badge variant="success" className="text-[10px] px-1.5 py-0">{qty} left</Badge>;
}

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const [open, setOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const { gradient, Icon } = getTheme(product.name);
  const totalAvailable = product.inventory.reduce((s, i) => s + i.availableQuantity, 0);
  const isOutOfStock = totalAvailable === 0;

  return (
    <>
      <div className="group relative z-0 hover:z-10 flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300">

        {/* ── Image area ─────────────────────────────────────────── */}
        <div className="relative h-52 w-full overflow-hidden">

          {/* Gradient placeholder — visible IMMEDIATELY, zero network wait */}
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <Icon className="h-16 w-16 text-white/40" />
          </div>

          {/* Real image cross-fades in once loaded */}
          {product.imageUrl && !imgError && (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              priority={priority}
              className={`object-cover transition-[opacity,transform] duration-500 group-hover:scale-105 ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          )}

          {/* Out-of-stock overlay */}
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

        {/* ── Content ────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 p-4 gap-3">
          <div>
            <h3 className="font-semibold text-slate-900 leading-snug">{product.name}</h3>
            {product.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{product.description}</p>
            )}
          </div>

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
