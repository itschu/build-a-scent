import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductGallery } from "@/components/shop/product-gallery";
import { ProductPurchase } from "@/components/shop/product-purchase";
import { NOTE_TIERS } from "@/lib/domain";
import { TIER_LABELS } from "@/lib/labels";
import { getShopProduct } from "@/server/dal/products";

export async function generateMetadata({ params }: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const product = await getShopProduct((await params).slug);
  return product
    ? { title: `${product.name} · Build a Scent`, description: product.description.slice(0, 160) }
    : { title: "Not found · Build a Scent" };
}

export default function ProductPage({ params }: PageProps<"/shop/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
      <Link href="/shop" className="mb-8 inline-block text-xs text-muted hover:text-gold">
        ← Back to the collection
      </Link>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Product params={params} />
      </Suspense>
    </main>
  );
}

async function Product({ params }: { params: PageProps<"/shop/[slug]">["params"] }) {
  const product = await getShopProduct((await params).slug);
  if (!product) notFound();

  return (
    <div className="grid gap-12 md:grid-cols-2">
      <ProductGallery images={product.images} name={product.name} />
      <div>
        <p className="mb-2 font-serif text-[0.7rem] uppercase tracking-display text-gold">{product.scentFamily}</p>
        <h1 className="mb-4 font-serif text-4xl text-cream">{product.name}</h1>
        {product.description && <p className="mb-8 whitespace-pre-line text-sm leading-relaxed text-muted">{product.description}</p>}
        {NOTE_TIERS.some((t) => product.notes[t].length > 0) && (
          <dl className="mb-8 divide-y divide-line-soft border-y border-line text-sm">
            {NOTE_TIERS.map((t) =>
              product.notes[t].length ? (
                <div key={t} className="flex gap-4 py-3">
                  <dt className="w-16 shrink-0 font-serif text-xs uppercase tracking-label text-gold">{TIER_LABELS[t]}</dt>
                  <dd className="text-champagne">{product.notes[t].join(", ")}</dd>
                </div>
              ) : null,
            )}
          </dl>
        )}
        <ProductPurchase product={product} />
      </div>
    </div>
  );
}
