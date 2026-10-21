import type { OrderStatus } from "./domain";

export const ADMIN_ORDER_STATUS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  verifying_payment: "Verifying payment",
  payment_failed: "Payment failed",
  expired: "Expired",
  paid: "Paid",
  in_production: "In production",
  shipped: "Shipped",
  fulfilled: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** Fulfilment moves one step at a time (Tech Plan, Decision 19). */
export const NEXT_FULFILMENT_STEP: Partial<Record<OrderStatus, OrderStatus>> = {
  paid: "in_production",
  in_production: "shipped",
  shipped: "fulfilled",
};

export const CANCELLABLE: OrderStatus[] = ["pending_payment", "verifying_payment", "payment_failed", "expired"];
export const REFUNDABLE: OrderStatus[] = ["paid", "in_production", "shipped", "fulfilled"];
