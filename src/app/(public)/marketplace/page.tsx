import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListingCard } from "@/components/marketplace/listing-card";
import { buttonClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import { matchesMarketplaceFilters, parseMarketplaceFilters, type MarketplaceFilters } from "@/lib/marketplace-filters";
import { PRICE_BANDS } from "@/lib/shop-filters";
import { getCachedMarketplace } from "@/server/cached";

export const metadata: Metadata = {
  title: "Marketplace · Build a Scent",
  description: "Scents blended by our community of creators.",
};

export default function MarketplacePage({ searchParams }: PageProps<"/marketplace">) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-8">
      <Eyebrow>Community creations</Eyebrow>
      <h1 className="mb-2 font-serif text-4xl text-cream">Marketplace</h1>
      <p className="mb-10 max-w-xl text-sm text-muted">
        Blends created by our community. Every bottle is made to order by our team, and each sale supports its creator.
      </p>
      <Suspense fallback={<p className="text-sm text-muted">Loading the marketplace…</p>}>
        <Listings searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function href(filters: MarketplaceFilters, patch: Partial<MarketplaceFilters>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filters, ...patch })) if (v) params.set(k, v);
  const q = params.toString();
  return q ? `/marketplace?${q}` : "/marketplace";
}

function Chip({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn("border px-3 py-1.5 text-xs", active ? "border-gold text-gold" : "border-line text-muted hover:border-gold-dim hover:text-champagne")}
    >
      {children}
    </Link>
  );
}

async function Listings({ searchParams }: { searchParams: PageProps<"/marketplace">["searchParams"] }) {
  // Request data first: cached database reads must never run during `next build`.
  const params = await searchParams;
  const listings = await getCachedMarketplace();
  const filters = parseMarketplaceFilters(params);
  const families = [...new Set(listings.flatMap((l) => l.families))].sort();
  const notes = [...new Set(listings.flatMap((l) => l.featuredNotes))].sort();
  const shown = listings.filter((l) => matchesMarketplaceFilters(l, filters));

  return (
    <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Filters" className="space-y-6">
        <div>
          <p className="mb-3 font-serif text-[0.7rem] uppercase tracking-label text-muted">Scent family</p>
          <div className="flex flex-wrap gap-2">
            <Chip to={href(filters, { family: null })} active={!filters.family}>All</Chip>
            {families.map((f) => (
              <Chip key={f} to={href(filters, { family: f })} active={filters.family === f}>{f}</Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 font-serif text-[0.7rem] uppercase tracking-label text-muted">Price</p>
          <div className="flex flex-wrap gap-2">
            <Chip to={href(filters, { price: null })} active={!filters.price}>Any</Chip>
            {PRICE_BANDS.map((b) => (
              <Chip key={b.key} to={href(filters, { price: b.key })} active={filters.price === b.key}>{b.label}</Chip>
            ))}
          </div>
        </div>
        {notes.length > 0 && (
          <div>
            <p className="mb-3 font-serif text-[0.7rem] uppercase tracking-label text-muted">Featured notes</p>
            <div className="flex flex-wrap gap-2">
              <Chip to={href(filters, { note: null })} active={!filters.note}>Any</Chip>
              {notes.map((n) => (
                <Chip key={n} to={href(filters, { note: n })} active={filters.note === n}>{n}</Chip>
              ))}
            </div>
          </div>
        )}
      </nav>
      <section aria-live="polite">
        <p className="mb-4 text-xs text-faint">{shown.length} {shown.length === 1 ? "scent" : "scents"}</p>
        {shown.length === 0 ? (
          <div className="border border-dashed border-line px-6 py-16 text-center">
            <p className="mb-6 font-serif text-lg text-champagne">
              {listings.length === 0 ? "No community scents yet. Yours could be the first." : "Nothing matches those filters."}
            </p>
            <Link href={listings.length === 0 ? "/build" : "/marketplace"} className={buttonClasses({ variant: "ghost" })}>
              {listings.length === 0 ? "Create a scent to sell" : "Clear filters"}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
