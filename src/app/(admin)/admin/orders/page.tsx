import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { ADMIN_ORDER_STATUS } from "@/lib/admin-order-status";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { ORDER_ITEM_TYPES, ORDER_STATUSES, type OrderItemType, type OrderStatus } from "@/lib/domain";
import { formatNaira } from "@/lib/money";
import { getActor } from "@/server/auth/session";
import { listOrdersForAdmin, ORDER_TABS, ORDERS_PAGE_SIZE, type OrderTab } from "@/server/dal/admin-orders";

const TAB_LABELS: Record<OrderTab, string> = { review: "Needs review", fulfil: "To fulfil", all: "All orders" };
const TYPE_LABELS: Record<OrderItemType, string> = { custom_scent: "Custom", standard_product: "Shop", marketplace_listing: "Marketplace" };

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <>
      <AdminPageHeader eyebrow="Operations" title="Orders" />
      <Suspense fallback={<p className="text-sm text-muted">Loading orders…</p>}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function one(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value ? value : null;
}

function minutesSince(date: Date): number {
  return Math.round((Date.now() - date.getTime()) / 60_000);
}

async function Orders({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  const params = await searchParams;
  const tab = (ORDER_TABS as readonly string[]).includes(one(params.tab) ?? "") ? (one(params.tab) as OrderTab) : "review";
  const status = (ORDER_STATUSES as readonly string[]).includes(one(params.status) ?? "") ? (one(params.status) as OrderStatus) : null;
  const type = (ORDER_ITEM_TYPES as readonly string[]).includes(one(params.type) ?? "") ? (one(params.type) as OrderItemType) : null;
  const q = one(params.q);
  const page = Math.max(1, Number(one(params.page)) || 1);
  const { rows, total, counts } = await listOrdersForAdmin(await getActor(), { tab, status, type, q, page });
  const pages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  const link = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ tab, status, type, q, ...patch })) if (v) next.set(k, String(v));
    return `/admin/orders?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 border-b border-line" aria-label="Order queues">
        {ORDER_TABS.map((t) => (
          <Link
            key={t}
            href={link({ tab: t, page: null, status: null })}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 font-serif text-xs uppercase tracking-label",
              t === tab ? "border-gold text-gold" : "border-transparent text-muted hover:text-champagne",
            )}
          >
            {TAB_LABELS[t]} <span className="text-faint">{counts[t]}</span>
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap items-end gap-3" action="/admin/orders">
        <input type="hidden" name="tab" value={tab} />
        <Input name="q" defaultValue={q ?? ""} placeholder="Order number or email" aria-label="Search" className="max-w-64 py-2" />
        <Select name="status" defaultValue={status ?? ""} aria-label="Status" className="max-w-48 py-2">
          <option value="">Any status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{ADMIN_ORDER_STATUS[s]}</option>
          ))}
        </Select>
        <Select name="type" defaultValue={type ?? ""} aria-label="Item type" className="max-w-48 py-2">
          <option value="">Any type</option>
          {ORDER_ITEM_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </Select>
        <button className={buttonClasses({ variant: "ghost", size: "sm" })}>Filter</button>
      </form>

      {rows.length === 0 ? (
        <p className="border border-dashed border-line p-10 text-center text-sm text-muted">
          {tab === "review" ? "Nothing needs review. 🎉" : "No orders match."}
        </p>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line bg-coal font-serif text-[0.65rem] uppercase tracking-label text-muted">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-raised">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-gold hover:underline">
                      {o.orderNumber}
                    </Link>
                    <span className="block text-xs text-faint">{o.paymentGateway}</span>
                  </td>
                  <td className="px-4 py-3 text-champagne">
                    {o.customerName}
                    <span className="block text-xs text-faint">{o.email}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{o.itemTypes.map((t) => TYPE_LABELS[t]).join(", ")}</td>
                  <td className="px-4 py-3 text-champagne">{formatNaira(o.totalKobo)}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="text-champagne">{ADMIN_ORDER_STATUS[o.status]}</span>
                    {o.status === "verifying_payment" && o.verifyingSince && (
                      <span className="block text-faint">for {minutesSince(o.verifyingSince)} min</span>
                    )}
                    {o.needsAttention && <span className="mt-1 block text-danger">⚠ {o.attentionReason ?? "Needs attention"}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="flex items-center gap-3 text-xs text-muted" aria-label="Pages">
          {page > 1 && <Link href={link({ page: String(page - 1) })} className={buttonClasses({ variant: "ghost", size: "sm" })}>← Previous</Link>}
          Page {page} of {pages}
          {page < pages && <Link href={link({ page: String(page + 1) })} className={buttonClasses({ variant: "ghost", size: "sm" })}>Next →</Link>}
        </nav>
      )}
    </div>
  );
}
