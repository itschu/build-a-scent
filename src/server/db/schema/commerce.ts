import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  LEDGER_ENTRY_TYPES,
  LEDGER_STATUSES,
  ORDER_ITEM_TYPES,
  ORDER_STATUSES,
  PAYMENT_GATEWAYS,
  RESERVATION_STATUSES,
  type LedgerEntryType,
  type LedgerStatus,
  type OrderItemType,
  type OrderStatus,
  type PaymentGateway,
  type ReservationStatus,
} from "@/lib/domain";
import { id, oneOf, timestamps } from "./_helpers";
import { users } from "./auth";
import { productVariants, shippingZones } from "./catalog";
import { marketplaceListings } from "./scents";

export type DeliveryAddress = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
};

export const orders = pgTable(
  "orders",
  {
    id: id(),
    orderNumber: text().notNull().unique("orders_order_number_unique"),
    // Null for guest orders; kept as history if the account is deleted.
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    // Contact email for every order; used with order_number for guest lookup.
    email: text().notNull(),
    status: text().$type<OrderStatus>().notNull().default("pending_payment"),
    needsAttention: boolean().notNull().default(false),
    attentionReason: text(),
    paymentGateway: text().$type<PaymentGateway>().notNull(),
    paymentReference: text().unique("orders_payment_reference_unique"),
    subtotalKobo: bigint({ mode: "number" }).notNull(),
    shippingFeeKobo: bigint({ mode: "number" }).notNull(),
    totalKobo: bigint({ mode: "number" }).notNull(),
    currency: text().notNull().default("NGN"),
    deliveryAddress: jsonb().$type<DeliveryAddress>().notNull(),
    shippingZoneId: uuid().references(() => shippingZones.id),
    etaFrom: date(),
    etaTo: date(),
    paidAt: timestamp({ withTimezone: true }),
    refundReason: text(),
    refundedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("orders_status_idx").on(t.status, t.createdAt),
    index("orders_user_idx").on(t.userId),
    index("orders_needs_attention_idx").on(t.needsAttention).where(sql`${t.needsAttention}`),
    check("orders_status_check", oneOf(t.status, ORDER_STATUSES)),
    check("orders_gateway_check", oneOf(t.paymentGateway, PAYMENT_GATEWAYS)),
    check("orders_currency_check", sql`${t.currency} = 'NGN'`),
    check(
      "orders_totals_check",
      sql`${t.subtotalKobo} >= 0 and ${t.shippingFeeKobo} >= 0 and ${t.totalKobo} = ${t.subtotalKobo} + ${t.shippingFeeKobo}`,
    ),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    itemType: text().$type<OrderItemType>().notNull(),
    // Bottle option (custom scent), product variant, or marketplace listing.
    referenceId: uuid().notNull(),
    // Immutable record of what was bought; the shape is defined with checkout.
    itemSnapshot: jsonb().$type<Record<string, unknown>>().notNull(),
    quantity: integer().notNull(),
    unitPriceKobo: bigint({ mode: "number" }).notNull(),
    lineTotalKobo: bigint({ mode: "number" }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    check("order_items_type_check", oneOf(t.itemType, ORDER_ITEM_TYPES)),
    check("order_items_quantity_check", sql`${t.quantity} > 0`),
    check(
      "order_items_total_check",
      sql`${t.lineTotalKobo} = ${t.unitPriceKobo} * ${t.quantity}`,
    ),
  ],
);

export const inventoryReservations = pgTable(
  "inventory_reservations",
  {
    id: id(),
    productVariantId: uuid()
      .notNull()
      .references(() => productVariants.id),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    quantity: integer().notNull(),
    status: text().$type<ReservationStatus>().notNull().default("active"),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("inventory_reservations_variant_idx").on(t.productVariantId, t.status),
    index("inventory_reservations_expiry_idx").on(t.status, t.expiresAt),
    check("inventory_reservations_status_check", oneOf(t.status, RESERVATION_STATUSES)),
    check("inventory_reservations_quantity_check", sql`${t.quantity} > 0`),
  ],
);

export const sellerEarningsLedger = pgTable(
  "seller_earnings_ledger",
  {
    id: id(),
    sellerId: uuid()
      .notNull()
      .references(() => users.id),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    orderItemId: uuid()
      .notNull()
      .references(() => orderItems.id),
    marketplaceListingId: uuid()
      .notNull()
      .references(() => marketplaceListings.id),
    // Negative for debits.
    amountKobo: bigint({ mode: "number" }).notNull(),
    entryType: text().$type<LedgerEntryType>().notNull(),
    status: text().$type<LedgerStatus>().notNull().default("pending"),
    ...timestamps,
  },
  (t) => [
    unique("seller_earnings_ledger_item_entry_unique").on(t.orderItemId, t.entryType),
    index("seller_earnings_ledger_seller_idx").on(t.sellerId, t.status),
    check("seller_earnings_ledger_entry_type_check", oneOf(t.entryType, LEDGER_ENTRY_TYPES)),
    check("seller_earnings_ledger_status_check", oneOf(t.status, LEDGER_STATUSES)),
  ],
);
