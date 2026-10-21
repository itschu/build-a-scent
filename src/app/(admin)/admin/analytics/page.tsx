import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { BarList, StatTile } from "@/components/admin/charts";
import { cn } from "@/lib/cn";
import { formatNaira } from "@/lib/money";
import { getActor } from "@/server/auth/session";
import { ANALYTICS_RANGES, getAnalytics, type AnalyticsRange } from "@/server/dal/analytics";

const RANGE_LABELS: Record<AnalyticsRange, string> = { "30d": "Last 30 days", "90d": "Last 90 days", all: "All time" };
const TYPE_LABELS = { custom_scent: "Custom scents", standard_product: "Shop products", marketplace_listing: "Marketplace" } as const;

export default function AdminAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  return (
    <>
      <AdminPageHeader eyebrow="Insights" title="Analytics" />
      <Suspense fallback={<p className="text-sm text-muted">Crunching numbers…</p>}>
        <Analytics searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Analytics({ searchParams }: { searchParams: PageProps<"/admin/analytics">["searchParams"] }) {
  const requested = (await searchParams).range;
  const range: AnalyticsRange = typeof requested === "string" && requested in ANALYTICS_RANGES ? (requested as AnalyticsRange) : "30d";
  const a = await getAnalytics(await getActor(), range);

  return (
    <div className="space-y-8">
      <nav className="flex gap-2" aria-label="Date range">
        {(Object.keys(ANALYTICS_RANGES) as AnalyticsRange[]).map((r) => (
          <Link
            key={r}
            href={`/admin/analytics?range=${r}`}
            aria-current={r === range ? "true" : undefined}
            className={cn("border px-3 py-1.5 text-xs", r === range ? "border-gold text-gold" : "border-line text-muted hover:text-champagne")}
          >
            {RANGE_LABELS[r]}
          </Link>
        ))}
      </nav>
      <p className="-mt-4 text-xs text-faint">Paid, in-production, shipped and delivered orders. Refunds and unpaid orders are excluded.</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue" value={formatNaira(a.revenueKobo)} note="Including shipping" />
        <StatTile label="Orders" value={a.orderCount.toLocaleString("en-NG")} />
        <StatTile label="Average order" value={formatNaira(a.averageOrderKobo)} />
        <StatTile
          label="Seller earnings"
          value={formatNaira(a.sellerEarnings.pendingKobo + a.sellerEarnings.availableKobo)}
          note={`${formatNaira(a.sellerEarnings.pendingKobo)} pending · ${formatNaira(a.sellerEarnings.availableKobo)} available · ${a.sellerEarnings.sellers} sellers (all time)`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BarList
          title="Revenue by order type"
          data={a.byType
            .sort((x, y) => y.revenueKobo - x.revenueKobo)
            .map((t) => ({
              label: TYPE_LABELS[t.type],
              value: t.revenueKobo,
              display: formatNaira(t.revenueKobo),
              detail: `${t.orders} orders · ${t.units} units`,
            }))}
        />
        <BarList
          title="Top ingredients by selection"
          data={a.topIngredients.map((i) => ({
            label: i.name,
            value: i.selections,
            display: `${i.selections} ${i.selections === 1 ? "bottle" : "bottles"}`,
            swatch: i.colorHex,
          }))}
        />
      </div>

      <section className="border border-line bg-surface">
        <h2 className="border-b border-line px-5 py-3 font-serif text-[0.7rem] uppercase tracking-label text-gold">Top-selling marketplace scents</h2>
        {a.topMarketplace.length === 0 ? (
          <p className="p-5 text-sm text-faint">No marketplace sales in this period.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="font-serif text-[0.65rem] uppercase tracking-label text-muted">
              <tr>
                <th className="px-5 py-2">Scent</th>
                <th className="px-5 py-2">Creator</th>
                <th className="px-5 py-2 text-right">Bottles</th>
                <th className="px-5 py-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {a.topMarketplace.map((m) => (
                <tr key={m.listingId}>
                  <td className="px-5 py-2 text-champagne">{m.name}</td>
                  <td className="px-5 py-2 text-muted">{m.creatorName}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{m.units}</td>
                  <td className="px-5 py-2 text-right tabular-nums text-gold">{formatNaira(m.revenueKobo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
