"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  advanceFulfilmentAction,
  cancelOrderAction,
  recordRefundAction,
  resolveAttentionAction,
  reverifyOrderAction,
} from "@/app/(admin)/admin/orders/actions";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";
import { ADMIN_ORDER_STATUS, CANCELLABLE, NEXT_FULFILMENT_STEP, REFUNDABLE } from "@/lib/admin-order-status";
import type { OrderStatus } from "@/lib/domain";

const STEP_LABELS: Partial<Record<OrderStatus, string>> = {
  in_production: "Start production",
  shipped: "Mark as shipped",
  fulfilled: "Mark as delivered",
};

const REVERIFY_MESSAGES: Record<string, string> = {
  paid: "The gateway confirmed payment. The order is now paid and the customer has been emailed.",
  failed: "The gateway reports the payment failed.",
  pending: "The gateway has no completed payment for this order yet.",
  amount_mismatch: "The gateway reports a different amount. The order stays flagged.",
  already_processed: "Nothing to change: the order is already up to date.",
};

type OrderSummary = { id: string; status: OrderStatus; needsAttention: boolean; attentionReason: string | null; hasStandardItems: boolean };

export function OrderActions({ order }: { order: OrderSummary }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(order.hasStandardItems);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const next = NEXT_FULFILMENT_STEP[order.status];
  const canVerify = ["pending_payment", "verifying_payment", "payment_failed", "expired"].includes(order.status);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setPending(key);
    setError(null);
    const result = await fn();
    setPending(null);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return false;
    }
    toast(success);
    router.refresh();
    return true;
  }

  return (
    <aside className="h-fit space-y-5 border border-line bg-coal p-5">
      <h2 className="font-serif text-[0.7rem] uppercase tracking-label text-gold">Actions</h2>
      {error && <Notice tone="error">{error}</Notice>}

      {order.needsAttention && (
        <div className="space-y-3 border border-danger/40 p-4">
          <p className="text-sm text-danger">⚠ {order.attentionReason ?? "Needs attention"}</p>
          <Field label="How was this resolved?">
            {({ id }) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />}
          </Field>
          <Button
            size="sm"
            variant="ghost"
            pending={pending === "resolve"}
            onClick={() => run("resolve", () => resolveAttentionAction(order.id, note), "Marked as resolved.")}
          >
            Mark resolved
          </Button>
        </div>
      )}

      {canVerify && (
        <div className="space-y-2">
          <Button
            className="w-full"
            pending={pending === "verify"}
            onClick={async () => {
              setPending("verify");
              setError(null);
              const result = await reverifyOrderAction(order.id);
              setPending(null);
              if (!result.ok) return setError(result.error);
              toast(REVERIFY_MESSAGES[result.data] ?? `Gateway result: ${result.data}`, { tone: result.data === "paid" ? "success" : "info" });
              router.refresh();
            }}
          >
            Re-verify with gateway
          </Button>
          <p className="text-xs text-faint">Asks the payment provider directly and applies its answer.</p>
        </div>
      )}

      {next && (
        <Button
          className="w-full"
          pending={pending === "advance"}
          onClick={() => run("advance", () => advanceFulfilmentAction(order.id, next), `Order is now ${ADMIN_ORDER_STATUS[next].toLowerCase()}.`)}
        >
          {STEP_LABELS[next]}
        </Button>
      )}

      {CANCELLABLE.includes(order.status) && (
        <Button
          variant="danger"
          className="w-full"
          pending={pending === "cancel"}
          onClick={() =>
            window.confirm("Cancel this unpaid order? Any held stock is released.") &&
            run("cancel", () => cancelOrderAction(order.id), "Order cancelled.")
          }
        >
          Cancel order
        </Button>
      )}

      {REFUNDABLE.includes(order.status) &&
        (refundOpen ? (
          <div className="space-y-3 border border-line p-4">
            <p className="text-xs text-muted">
              First issue the full refund in the Paystack or Flutterwave dashboard, then record it here. Seller earnings for this order are reversed and the customer is emailed.
            </p>
            <Field label="Reason">
              {({ id }) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-16" />}
            </Field>
            {order.hasStandardItems && (
              <label className="flex items-center gap-2 text-sm text-champagne">
                <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="accent-gold" />
                Return shop items to stock
              </label>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger"
                pending={pending === "refund"}
                onClick={async () => {
                  if (await run("refund", () => recordRefundAction(order.id, { reason, restock }), "Refund recorded.")) setRefundOpen(false);
                }}
              >
                Record refund
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRefundOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" className="w-full" onClick={() => setRefundOpen(true)}>
            Record refund…
          </Button>
        ))}

      {!next && !canVerify && !CANCELLABLE.includes(order.status) && !REFUNDABLE.includes(order.status) && (
        <p className="text-xs text-faint">No actions available for {ADMIN_ORDER_STATUS[order.status].toLowerCase()} orders.</p>
      )}
    </aside>
  );
}
