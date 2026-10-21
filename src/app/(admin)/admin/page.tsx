import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { StatTile } from "@/components/admin/charts";
import { formatNaira } from "@/lib/money";
import { getActor } from "@/server/auth/session";
import { countUndeliverableEmails } from "@/server/dal/admin-email";
import { getAnalytics, getQueueCounts } from "@/server/dal/analytics";

export default function AdminDashboardPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Overview" title="Dashboard" />
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  const actor = await getActor();
  const [queues, last30, undeliverable] = await Promise.all([
    getQueueCounts(actor),
    getAnalytics(actor, "30d"),
    countUndeliverableEmails(actor),
  ]);
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 font-serif text-[0.7rem] uppercase tracking-label text-gold">Needs you</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Payments to review" value={String(queues.needsReview)} note="Stuck verification or flagged" href="/admin/orders?tab=review" />
          <StatTile label="Orders to fulfil" value={String(queues.toFulfil)} note="Paid, in production or shipped" href="/admin/orders?tab=fulfil" />
          <StatTile label="Listings to moderate" value={String(queues.pendingListings)} href="/admin/listings" />
          <StatTile label="Undelivered emails" value={String(undeliverable)} note="Gave up after retries" href="/admin/settings#email" />
        </div>
      </section>
      <section>
        <h2 className="mb-4 font-serif text-[0.7rem] uppercase tracking-label text-gold">Last 30 days</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Revenue" value={formatNaira(last30.revenueKobo)} href="/admin/analytics" />
          <StatTile label="Orders" value={String(last30.orderCount)} />
          <StatTile label="Average order" value={formatNaira(last30.averageOrderKobo)} />
        </div>
      </section>
    </div>
  );
}
