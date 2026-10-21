"use client";

import type { BuyerOrderView } from "@/server/dal/orders";
import { OrderSummary } from "./order-summary";

/** OrderSummary for orders fetched in the browser (dates arrive as strings). */
export function OrderSummaryClient({ order }: { order: BuyerOrderView }) {
  return <OrderSummary order={{ ...order, createdAt: new Date(order.createdAt) }} />;
}
