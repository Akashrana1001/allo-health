import Link from "next/link";
import { Package2 } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/products" className="flex items-center gap-2 font-bold text-lg text-primary">
          <Package2 className="h-5 w-5" />
          Allo Inventory
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/products" className="hover:text-foreground transition-colors">
            Products
          </Link>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            Live Demo
          </span>
        </nav>
      </div>
    </header>
  );
}
