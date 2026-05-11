"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReserveModal } from "./reserve-modal";
import type { Product } from "@/lib/schemas";

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0)
    return <Badge variant="danger">Out of Stock</Badge>;
  if (qty <= 5)
    return <Badge variant="warning">Low Stock: {qty}</Badge>;
  return <Badge variant="success">In Stock: {qty}</Badge>;
}

export function ProductCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const totalAvailable = product.inventory.reduce(
    (sum, inv) => sum + inv.availableQuantity,
    0
  );

  return (
    <>
      <Card className="flex flex-col overflow-hidden">
        <div className="relative h-48 w-full bg-muted">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}
        </div>

        <CardHeader className="pb-2">
          <CardTitle className="text-base">{product.name}</CardTitle>
          {product.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
          )}
        </CardHeader>

        <CardContent className="flex-1 pb-2">
          <p className="text-lg font-bold text-primary mb-3">
            ₹{Number(product.price).toLocaleString("en-IN")}
          </p>
          <div className="space-y-1.5">
            {product.inventory.map((inv) => (
              <div key={inv.warehouseId} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{inv.warehouseName}</span>
                <StockBadge qty={inv.availableQuantity} />
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter>
          <Button
            className="w-full"
            disabled={totalAvailable === 0}
            onClick={() => setOpen(true)}
          >
            {totalAvailable === 0 ? "Out of Stock" : "Reserve"}
          </Button>
        </CardFooter>
      </Card>

      <ReserveModal product={product} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
