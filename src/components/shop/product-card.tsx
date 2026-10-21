/* eslint-disable @next/next/no-img-element -- product images may be any admin-provided URL */
import Link from "next/link";
import { DecorativeBottle } from "@/components/scent/decorative-bottle";
import { FORMAT_LABELS } from "@/lib/labels";
import { formatNaira } from "@/lib/money";
import type { ShopProductCard } from "@/server/dal/products";

export function ProductCard({ product }: { product: ShopProductCard }) {
  return (
    <Link href={`/shop/${product.slug}`} className="group flex flex-col border border-line bg-surface transition-colors hover:border-gold-dim">
      <div className="flex aspect-[4/5] items-center justify-center overflow-hidden bg-coal">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <DecorativeBottle className="h-2/3" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="font-serif text-[0.65rem] uppercase tracking-label text-gold">{product.scentFamily}</p>
        <h2 className="font-serif text-lg text-cream">{product.name}</h2>
        <p className="text-xs text-muted">{product.formats.map((f) => FORMAT_LABELS[f]).join(" · ")}</p>
        <p className="mt-auto pt-3 text-sm text-champagne">
          {product.minPriceKobo === product.maxPriceKobo ? formatNaira(product.minPriceKobo) : `From ${formatNaira(product.minPriceKobo)}`}
          {!product.inStock && <span className="ml-2 text-xs text-danger">Out of stock</span>}
        </p>
      </div>
    </Link>
  );
}
