import { LineThumb } from "@/components/cart/line-thumb";
import { NOTE_TIERS } from "@/lib/domain";
import { formatDate } from "@/lib/dates";
import { formatWindow } from "@/lib/delivery-estimate";
import { TIER_LABELS } from "@/lib/labels";
import { formatNaira } from "@/lib/money";
import type { BuyerItemView } from "@/lib/order-snapshot";
import { BUYER_ORDER_STATUS } from "@/lib/order-status";
import type { BuyerOrderView } from "@/server/dal/orders";

function ItemNotes({ view }: { view: BuyerItemView }) {
  const rows =
    view.type === "marketplace_listing"
      ? NOTE_TIERS.map((t) => [t, [...view.profile[t].featured, ...view.profile[t].families.map((f) => `${f} accord`)]] as const)
      : NOTE_TIERS.map((t) => [t, view.notes[t]] as const);
  if (rows.every(([, values]) => values.length === 0)) return null;
  return (
    <dl className="mt-2 space-y-0.5 text-xs">
      {rows.map(([tier, values]) =>
        values.length ? (
          <div key={tier} className="flex gap-2">
            <dt className="w-12 shrink-0 font-serif uppercase tracking-label text-gold">{TIER_LABELS[tier]}</dt>
            <dd className="text-muted">{values.join(" · ")}</dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}

/** A buyer-safe order breakdown (marketplace formulas are never included). */
export function OrderSummary({ order, showStatus = true }: { order: BuyerOrderView; showStatus?: boolean }) {
  return (
    <div className="border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="font-serif text-lg text-cream">{order.orderNumber}</p>
          <p className="text-xs text-faint">Placed {formatDate(order.createdAt)}</p>
        </div>
        {showStatus && (
          <span className="border border-gold-dim px-3 py-1 font-serif text-[0.65rem] uppercase tracking-label text-gold">
            {BUYER_ORDER_STATUS[order.status]}
          </span>
        )}
      </div>
      <ul className="divide-y divide-line-soft px-5">
        {order.items.map((item, i) => (
          <li key={i} className="flex gap-4 py-4">
            <LineThumb
              colors={item.view.type === "standard_product" ? undefined : item.view.colors}
              imageUrl={item.view.type === "standard_product" ? item.view.imageUrl : null}
              className="h-20 w-12 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-4">
                <div>
                  <p className="font-serif text-cream">
                    {item.view.name} <span className="text-sm text-muted">× {item.quantity}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {item.view.detail}
                    {item.view.type === "marketplace_listing" && ` · by ${item.view.creatorName}`}
                  </p>
                </div>
                <span className="text-sm text-gold">{formatNaira(item.lineTotalKobo)}</span>
              </div>
              <ItemNotes view={item.view} />
            </div>
          </li>
        ))}
      </ul>
      <dl className="space-y-2 border-t border-line px-5 py-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd>{formatNaira(order.subtotalKobo)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Shipping</dt>
          <dd>{formatNaira(order.shippingFeeKobo)}</dd>
        </div>
        <div className="flex justify-between font-serif text-lg">
          <dt className="text-champagne">Total</dt>
          <dd className="text-gold">{formatNaira(order.totalKobo)}</dd>
        </div>
      </dl>
      <div className="border-t border-line px-5 py-4 text-xs text-muted">
        Delivering to {order.deliverTo.fullName}, {order.deliverTo.city}, {order.deliverTo.state}
        {order.etaFrom && order.etaTo && ` · estimated ${formatWindow(order.etaFrom, order.etaTo)}`}
      </div>
    </div>
  );
}
