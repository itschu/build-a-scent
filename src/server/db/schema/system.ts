import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { EMAIL_STATUSES, PAYMENT_GATEWAYS, type EmailStatus, type PaymentGateway } from "@/lib/domain";
import { id, oneOf, timestamps } from "./_helpers";
import { users } from "./auth";

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text().notNull(),
    message: text().notNull(),
    link: text(),
    isRead: boolean().notNull().default(false),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.isRead, t.createdAt)],
);

export const platformSettings = pgTable("platform_settings", {
  key: text().primaryKey(),
  value: jsonb().$type<unknown>().notNull(),
  isPublic: boolean().notNull().default(false),
  updatedAt: timestamps.updatedAt,
});

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    gateway: text().$type<PaymentGateway>().notNull(),
    eventId: text().notNull(),
    reference: text(),
    payload: jsonb().$type<unknown>().notNull(),
    processedAt: timestamp({ withTimezone: true }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    unique("webhook_events_gateway_event_unique").on(t.gateway, t.eventId),
    index("webhook_events_reference_idx").on(t.reference),
    check("webhook_events_gateway_check", oneOf(t.gateway, PAYMENT_GATEWAYS)),
  ],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: id(),
    dedupeKey: text().notNull().unique("email_outbox_dedupe_key_unique"),
    toEmail: text().notNull(),
    template: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    status: text().$type<EmailStatus>().notNull().default("pending"),
    attempts: integer().notNull().default(0),
    lastError: text(),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("email_outbox_due_idx").on(t.status, t.nextAttemptAt),
    check("email_outbox_status_check", oneOf(t.status, EMAIL_STATUSES)),
  ],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text().primaryKey(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [check("rate_limits_count_check", sql`${t.count} >= 0`)],
);

/** Every admin action on a user account, for accountability. */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: id(),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    targetUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    action: text().notNull(),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("admin_audit_log_target_idx").on(t.targetUserId, t.createdAt)],
);
