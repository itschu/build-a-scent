import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/shop/product-card";
import { buttonClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { BOTTLE_FORMATS } from "@/lib/domain";
import { FORMAT_LABELS } from "@/lib/labels";
import { matchesFilters, parseShopFilters, PRICE_BANDS, type ShopFilters } from "@/lib/shop-filters";
import { getCachedShopProducts } from "@/server/cached";

export const metadata: Metadata = {
  title: "Shop the collection · Build a Scent",
  description: "Signature fragrances, blended by hand in Lagos.",
};

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-8">
      <Eyebrow>The collection</Eyebrow>
      <h1 className="mb-2 font-serif text-4xl text-cream">Shop</h1>
      <p className="mb-10 max-w-xl text-sm text-muted">Our signature fragrances, blended by hand. Prefer something of your own? Build a custom scent.</p>
      <Suspense fallback={<p className="text-sm text-muted">Loading the collection…</p>}>
        <Catalogue searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function filterHref(filters: ShopFilters, patch: Partial<ShopFilters>): string {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
  const query = params.toString();
  return query ? `/shop?${query}` : "/shop";
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "border px-3 py-1.5 text-xs transition-colors",
        active ? "border-gold text-gold" : "border-line text-muted hover:border-gold-dim hover:text-champagne",
      )}
    >
      {children}
    </Link>
  );
}

async function Catalogue({ searchParams }: { searchParams: PageProps<"/shop">["searchParams"] }) {
  const [products, params] = await Promise.all([getCachedShopProducts(), searchParams]);
  const filters = parseShopFilters(params);
  const families = [...new Set(products.map((p) => p.scentFamily))].sort();
  const shown = products.filter((p) => matchesFilters(p, filters));
  const anyFilter = filters.family || filters.price || filters.format;

  return (
    <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Filters" className="space-y-6">
        <div>
          <p className="mb-3 font-serif text-[0.7rem] uppercase tracking-label text-muted">Scent family</p>
          <div className="flex flex-wrap gap-2">
            <Chip href={filterHref(filters, { family: null })} active={!filters.family}>All</Chip>
            {families.map((f) => (
              <Chip key={f} href={filterHref(filters, { family: f })} active={filters.family === f}>
                {f}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 font-serif text-[0.7rem] uppercase tracking-label text-muted">Price</p>
          <div className="flex flex-wrap gap-2">
            <Chip href={filterHref(filters, { price: null })} active={!filters.price}>Any</Chip>
            {PRICE_BANDS.map((b) => (
              <Chip key={b.key} href={filterHref(filters, { price: b.key })} active={filters.price === b.key}>
                {b.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 font-serif text-[0.7rem] uppercase tracking-label text-muted">Format</p>
          <div className="flex flex-wrap gap-2">
            <Chip href={filterHref(filters, { format: null })} active={!filters.format}>Any</Chip>
            {BOTTLE_FORMATS.map((f) => (
              <Chip key={f} href={filterHref(filters, { format: f })} active={filters.format === f}>
                {FORMAT_LABELS[f]}
              </Chip>
            ))}
          </div>
        </div>
        {anyFilter && (
          <Link href="/shop" className="block text-xs text-gold hover:underline">
            Clear filters
          </Link>
        )}
      </nav>

      <section aria-live="polite">
        <p className="mb-4 text-xs text-faint">
          {shown.length} {shown.length === 1 ? "fragrance" : "fragrances"}
        </p>
        {shown.length === 0 ? (
          <div className="border border-dashed border-line px-6 py-16 text-center">
            <p className="mb-6 font-serif text-lg text-champagne">
              {products.length === 0 ? "The collection is being prepared. Check back soon." : "Nothing matches those filters."}
            </p>
            <Link href={products.length === 0 ? "/build" : "/shop"} className={buttonClasses({ variant: "ghost" })}>
              {products.length === 0 ? "Build your own scent" : "Clear filters"}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">
            {shown.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
