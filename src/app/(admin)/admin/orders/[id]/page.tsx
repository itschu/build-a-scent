import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { OrderActions } from "@/components/admin/order-actions";
import { LineThumb } from "@/components/cart/line-thumb";
import { ADMIN_ORDER_STATUS } from "@/lib/admin-order-status";
import { formatDate } from "@/lib/dates";
import { formatWindow } from "@/lib/delivery-estimate";
import { NOTE_TIERS } from "@/lib/domain";
import { TIER_LABELS } from "@/lib/labels";
import { formatNaira } from "@/lib/money";
import type { ItemSnapshot } from "@/lib/order-snapshot";
import { getActor } from "@/server/auth/session";
import { NotFoundError } from "@/server/dal/actor";
import { getOrderForAdmin } from "@/server/dal/admin-orders";

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading order…</p>}>
      <Order params={params} />
    </Suspense>
  );
}

function Formula({ snapshot }: { snapshot: ItemSnapshot }) {
  if (snapshot.type === "standard_product") return <p className="text-xs text-muted">{snapshot.variantLabel}</p>;
  return (
    <dl className="mt-2 space-y-1 text-xs">
      {NOTE_TIERS.map((tier) => (
        <div key={tier} className="flex gap-3">
          <dt className="w-14 shrink-0 font-serif uppercase tracking-label text-gold">{TIER_LABELS[tier]}</dt>
          <dd className="text-champagne">
            {snapshot.formula
              .filter((i) => i.tier === tier)
              .map((i) => i.name)
              .join(", ")}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function colorsOf(snapshot: ItemSnapshot) {
  if (snapshot.type === "standard_product") return undefined;
  const by = (t: string) => snapshot.formula.filter((i) => i.tier === t).map((i) => i.colorHex);
  return { base: by("base"), heart: by("heart"), top: by("top") };
}

async function Order({ params }: { params: PageProps<"/admin/orders/[id]">["params"] }) {
  const { id } = await params;
  const detail = await getOrderForAdmin(await getActor(), id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const { order, items, webhookEvents, ledger, reservations } = detail;
  const address = order.deliveryAddress;

  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-block text-xs text-muted hover:text-gold">
        ← All orders
      </Link>
      <AdminPageHeader eyebrow={`${ADMIN_ORDER_STATUS[order.status]} · placed ${formatDate(order.createdAt)}`} title={order.orderNumber} />
      <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <section className="border border-line bg-surface">
            <h2 className="border-b border-line px-5 py-3 font-serif text-[0.7rem] uppercase tracking-label text-gold">Blend sheet</h2>
            <ul className="divide-y divide-line-soft">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 px-5 py-4">
                  <LineThumb
                    colors={colorsOf(item.snapshot)}
                    imageUrl={item.snapshot.type === "standard_product" ? item.snapshot.imageUrl : null}
                    className="h-20 w-12 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-4">
                      <p className="font-serif text-cream">
                        {item.snapshot.name} <span className="text-sm text-muted">× {item.quantity}</span>
                      </p>
                      <span className="text-sm text-gold">{formatNaira(item.lineTotalKobo)}</span>
                    </div>
                    <p className="text-xs text-muted">
                      {item.snapshot.type === "custom_scent" && `Custom · ${item.snapshot.bottle.label}`}
                      {item.snapshot.type === "marketplace_listing" &&
                        `Marketplace · ${item.snapshot.bottle.label} · by ${item.snapshot.creatorName} · seller earns ${formatNaira(item.snapshot.split.sellerEarningKobo * item.quantity)}`}
                      {item.snapshot.type === "standard_product" && "Shop product"}
                    </p>
                    <Formula snapshot={item.snapshot} />
                  </div>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-line px-5 py-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatNaira(order.subtotalKobo)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{formatNaira(order.shippingFeeKobo)}</dd></div>
              <div className="flex justify-between font-serif text-lg"><dt>Total</dt><dd className="text-gold">{formatNaira(order.totalKobo)}</dd></div>
            </dl>
          </section>

          <section className="grid gap-6 sm:grid-cols-2">
            <div className="border border-line p-5 text-sm">
              <h2 className="mb-3 font-serif text-[0.7rem] uppercase tracking-label text-gold">Deliver to</h2>
              <p className="text-champagne">{address.fullName}</p>
              <p className="text-muted">{address.address}</p>
              <p className="text-muted">{address.city}, {address.state}</p>
              <p className="mt-2 text-muted">{address.phone}</p>
              <p className="text-muted">{order.email}</p>
              {order.etaFrom && order.etaTo && <p className="mt-2 text-xs text-faint">Promised {formatWindow(order.etaFrom, order.etaTo)}</p>}
            </div>
            <div className="border border-line p-5 text-sm">
              <h2 className="mb-3 font-serif text-[0.7rem] uppercase tracking-label text-gold">Payment</h2>
              <dl className="space-y-1 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-muted">Gateway</dt><dd className="capitalize">{order.paymentGateway}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted">Reference</dt><dd className="break-all font-mono">{order.paymentReference}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted">Last gateway status</dt><dd>{order.lastGatewayStatus ?? "—"}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted">Direct verifications</dt><dd>{order.verifyAttempts}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted">Paid</dt><dd>{order.paidAt ? formatDate(order.paidAt) : "—"}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-muted">Webhooks</p>
              {webhookEvents.length === 0 ? (
                <p className="text-xs text-faint">None received</p>
              ) : (
                <ul className="text-xs text-faint">
                  {webhookEvents.map((e) => (
                    <li key={e.eventId}>{e.eventId} · {formatDate(e.createdAt)}{e.processedAt ? "" : " · unprocessed"}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {(ledger.length > 0 || reservations.length > 0 || order.refundReason) && (
            <section className="border border-line p-5 text-xs text-muted">
              {order.refundReason && <p className="mb-2">Refunded: {order.refundReason}</p>}
              {ledger.map((l) => (
                <p key={l.id}>Seller ledger: {l.entryType.replace("_", " ")} {formatNaira(l.amountKobo)} · {l.status}</p>
              ))}
              {reservations.map((r) => (
                <p key={r.id}>Stock hold: {r.quantity} · {r.status}</p>
              ))}
            </section>
          )}
        </div>
        <OrderActions
          order={{
            id: order.id,
            status: order.status,
            needsAttention: order.needsAttention,
            attentionReason: order.attentionReason,
            hasStandardItems: items.some((i) => i.itemType === "standard_product"),
          }}
        />
      </div>
    </>
  );
}
