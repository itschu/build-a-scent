// Tables owned by Better Auth. Property names follow Better Auth's field names;
// columns are snake_case via the client's `casing` option.
import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { USER_ROLES, type UserRole } from "@/lib/domain";
import { id, oneOf, timestamps } from "./_helpers";

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    role: text().$type<UserRole>().notNull().default("user"),
    // Set by an admin: a blocked user can't sign in and their listings are hidden.
    bannedAt: timestamp({ withTimezone: true }),
    banReason: text(),
    // Set when an admin deletes the account: personal data is anonymised, orders are kept.
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [check("users_role_check", oneOf(t.role, USER_ROLES))],
);

export const sessions = pgTable(
  "sessions",
  {
  id: id(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  token: text().notNull().unique(),
  ipAddress: text(),
  userAgent: text(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
  id: id(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true }),
  refreshTokenExpiresAt: timestamp({ withTimezone: true }),
  scope: text(),
  password: text(),
  ...timestamps,
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
  id: id(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  ...timestamps,
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);
