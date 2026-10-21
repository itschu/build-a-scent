import type { OrderStatus } from "./domain";

/** How each order status is described to customers. */
export const BUYER_ORDER_STATUS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  verifying_payment: "Payment under review",
  payment_failed: "Payment failed",
  expired: "Payment not completed",
  paid: "Paid · preparing your order",
  in_production: "Being blended",
  shipped: "Shipped",
  fulfilled: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};
