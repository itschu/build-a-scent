// Enumerations shared by the database schema, server code and client code.

export const NOTE_TIERS = ["base", "heart", "top"] as const;
export type NoteTier = (typeof NOTE_TIERS)[number];

export const BOTTLE_FORMATS = ["spray", "roll_on", "oil"] as const;
export type BottleFormat = (typeof BOTTLE_FORMATS)[number];

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SAVED_SCENT_STATUSES = ["draft", "saved"] as const;
export type SavedScentStatus = (typeof SAVED_SCENT_STATUSES)[number];

export const MIXER_STEPS = ["base", "heart", "top", "preview"] as const;
export type MixerStep = (typeof MIXER_STEPS)[number];

export const LISTING_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "unavailable",
  "withdrawn",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const ORDER_STATUSES = [
  "pending_payment",
  "verifying_payment",
  "payment_failed",
  "expired",
  "paid",
  "in_production",
  "shipped",
  "fulfilled",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_GATEWAYS = ["paystack", "flutterwave"] as const;
export type PaymentGateway = (typeof PAYMENT_GATEWAYS)[number];

export const ORDER_ITEM_TYPES = [
  "custom_scent",
  "standard_product",
  "marketplace_listing",
] as const;
export type OrderItemType = (typeof ORDER_ITEM_TYPES)[number];

export const RESERVATION_STATUSES = ["active", "consumed", "released"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const LEDGER_ENTRY_TYPES = ["sale_credit", "refund_debit", "payout_debit"] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const LEDGER_STATUSES = ["pending", "available", "void"] as const;
export type LedgerStatus = (typeof LEDGER_STATUSES)[number];

export const EMAIL_STATUSES = ["pending", "sent", "failed"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const MAX_INGREDIENTS_PER_TIER = 3;
export const LISTING_DESCRIPTION_MAX = 200;
export const MAX_FEATURED_NOTES = 3;
