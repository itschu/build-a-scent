import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { UserAccessControls, UserDetailsForm } from "@/components/admin/user-admin-panel";
import { UserStatusBadges } from "@/components/admin/user-status";
import { Notice } from "@/components/ui/notice";
import { ADMIN_ORDER_STATUS } from "@/lib/admin-order-status";
import { formatDate } from "@/lib/dates";
import { LISTING_STATUS_LABELS } from "@/lib/listing-status";
import { formatNaira } from "@/lib/money";
import { getActor } from "@/server/auth/session";
import { NotFoundError } from "@/server/dal/actor";
import { getUserForAdmin, type AdminUserDetail } from "@/server/dal/admin-users";

const ACTION_LABELS: Record<string, string> = {
  created_account: "Created the account",
  updated_details: "Edited details",
  verified_email: "Marked email as verified",
  unverified_email: "Marked email as unverified",
  changed_role: "Changed role",
  blocked: "Blocked the account",
  unblocked: "Unblocked the account",
  signed_out_everywhere: "Signed them out everywhere",
  sent_password_link: "Sent a password link",
  deleted_account: "Deleted the account",
};

export default function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading user…</p>}>
      <User params={params} />
    </Suspense>
  );
}

async function User({ params }: { params: PageProps<"/admin/users/[id]">["params"] }) {
  const { id } = await params;
  const actor = await getActor();
  const detail = await getUserForAdmin(actor, id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const { user, profile, stats, orders, listings, history, signInMethods } = detail;
  const isSelf = actor.kind === "user" && actor.userId === user.id;
  const liveListings = listings.filter((l) => l.status === "approved").length;

  return (
    <>
      <p className="mb-4 text-xs">
        <Link href="/admin/users" className="text-muted hover:text-gold">
          ← All users
        </Link>
      </p>
      <AdminPageHeader eyebrow={user.email} title={user.name} actions={<UserStatusBadges user={user} />} />

      {user.deletedAt && (
        <Notice className="mb-6">
          This account was deleted on {formatDate(user.deletedAt)}. Personal details were removed; orders are kept for your records.
        </Notice>
      )}
      {user.bannedAt && !user.deletedAt && (
        <Notice tone="error" className="mb-6">
          Blocked since {formatDate(user.bannedAt)}
          {user.banReason ? `: ${user.banReason}` : ""}. They can&apos;t sign in and their listings are hidden from buyers.
        </Notice>
      )}

      <dl className="mb-8 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-5">
        <Stat label="Paid orders" value={String(stats.orderCount)} />
        <Stat label="Total spent" value={formatNaira(stats.spendKobo)} />
        <Stat label="Saved scents" value={String(stats.savedScents)} />
        <Stat label="Drafts" value={String(stats.drafts)} />
        <Stat label="Live listings" value={String(liveListings)} />
      </dl>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-8">
          <Section title="Recent orders" action={orders.length > 0 ? { href: `/admin/orders?tab=all&q=${encodeURIComponent(user.email)}`, label: "All orders" } : undefined}>
            {orders.length === 0 ? (
              <Empty>No orders yet.</Empty>
            ) : (
              <ul className="divide-y divide-line-soft">
                {orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-gold hover:underline">
                      {o.orderNumber}
                    </Link>
                    <span className="text-xs text-muted">{ADMIN_ORDER_STATUS[o.status]}</span>
                    <span className="text-champagne">{formatNaira(o.totalKobo)}</span>
                    <span className="text-xs text-faint">{formatDate(o.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Marketplace listings">
            {listings.length === 0 ? (
              <Empty>No listings.</Empty>
            ) : (
              <ul className="divide-y divide-line-soft">
                {listings.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="text-champagne">{l.scentName ?? "Untitled scent"}</span>
                    <span className="text-xs text-muted">{LISTING_STATUS_LABELS[l.status]}</span>
                    <span className="text-xs text-faint">{formatDate(l.submittedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Account">
            <dl className="divide-y divide-line-soft text-sm">
              <Row label="Joined" value={formatDate(user.createdAt)} />
              <Row label="Sign-in methods" value={signInMethods.length ? signInMethods.join(", ") : "None (no password set yet)"} />
              <Row label="Signed in on" value={`${stats.activeSessions} ${stats.activeSessions === 1 ? "device" : "devices"}`} />
              <Row label="Phone" value={profile?.phone || "—"} />
              <Row
                label="Delivery address"
                value={[profile?.deliveryAddress, profile?.city, profile?.state].filter(Boolean).join(", ") || "—"}
              />
              <Row label="Public creator name" value={profile?.displayName || "—"} />
            </dl>
          </Section>

          <Section title="Admin history">
            {history.length === 0 ? (
              <Empty>No admin actions yet.</Empty>
            ) : (
              <ul className="divide-y divide-line-soft">
                {history.map((h) => (
                  <li key={h.id} className="px-4 py-3 text-sm">
                    <span className="text-champagne">{ACTION_LABELS[h.action] ?? h.action}</span>
                    <HistoryDetails details={h.details} />
                    <span className="block text-xs text-faint">
                      {h.actorName ?? "An admin"} · {formatDate(h.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {!user.deletedAt && (
          <div className="space-y-8">
            <UserDetailsForm
              user={{ id: user.id, name: user.name, email: user.email, displayName: profile?.displayName ?? "", phone: profile?.phone ?? "" }}
            />
            <UserAccessControls
              user={{
                id: user.id,
                name: user.name,
                role: user.role,
                emailVerified: user.emailVerified,
                blocked: user.bannedAt !== null,
              }}
              isSelf={isSelf}
            />
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-4">
      <dt className="font-serif text-[0.65rem] uppercase tracking-label text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-xl text-cream">{value}</dd>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-serif text-[0.7rem] uppercase tracking-label text-gold">{title}</h2>
        {action && (
          <Link href={action.href} className="text-xs text-muted hover:text-gold">
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 px-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-champagne">{value}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-faint">{children}</p>;
}

function HistoryDetails({ details }: { details: AdminUserDetail["history"][number]["details"] }) {
  const parts = Object.entries(details).map(([key, value]) => {
    if (value && typeof value === "object" && "from" in value && "to" in value) {
      const change = value as { from: unknown; to: unknown };
      return `${key}: ${String(change.from)} → ${String(change.to)}`;
    }
    return `${key}: ${String(value)}`;
  });
  return parts.length ? <span className="block text-xs text-muted">{parts.join(" · ")}</span> : null;
}
