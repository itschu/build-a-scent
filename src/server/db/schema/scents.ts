import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  LISTING_DESCRIPTION_MAX,
  LISTING_STATUSES,
  MIXER_STEPS,
  SAVED_SCENT_STATUSES,
  type ListingStatus,
  type MixerStep,
  type SavedScentStatus,
} from "@/lib/domain";
import type { Formula } from "@/lib/formula";
import { id, oneOf, timestamps } from "./_helpers";
import { users } from "./auth";
import { bottleOptions } from "./catalog";

export const savedScents = pgTable(
  "saved_scents",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Set when a scent is saved from the mixer's Edit mode; the original is never modified.
    parentScentId: uuid().references((): AnyPgColumn => savedScents.id, {
      onDelete: "set null",
    }),
    name: text(),
    formula: jsonb().$type<Formula>().notNull().default([]),
    formulaHash: text(),
    bottleOptionId: uuid().references(() => bottleOptions.id),
    status: text().$type<SavedScentStatus>().notNull(),
    currentStep: text().$type<MixerStep>(),
    isShared: boolean().notNull().default(false),
    shareToken: text().unique("saved_scents_share_token_unique"),
    ...timestamps,
  },
  (t) => [
    index("saved_scents_user_idx").on(t.userId, t.status),
    index("saved_scents_formula_hash_idx").on(t.formulaHash),
    check("saved_scents_status_check", oneOf(t.status, SAVED_SCENT_STATUSES)),
    check(
      "saved_scents_current_step_check",
      sql`${t.currentStep} is null or ${oneOf(t.currentStep, MIXER_STEPS)}`,
    ),
    check(
      "saved_scents_saved_complete_check",
      sql`${t.status} <> 'saved' or (${t.name} is not null and ${t.bottleOptionId} is not null and ${t.formulaHash} is not null)`,
    ),
  ],
);

export const marketplaceListings = pgTable(
  "marketplace_listings",
  {
    id: id(),
    savedScentId: uuid()
      .notNull()
      .references(() => savedScents.id),
    sellerId: uuid()
      .notNull()
      .references(() => users.id),
    bottleOptionId: uuid()
      .notNull()
      .references(() => bottleOptions.id),
    description: text().notNull().default(""),
    creatorMarkupKobo: bigint({ mode: "number" }).notNull(),
    featuredIngredientIds: jsonb().$type<string[]>().notNull().default([]),
    status: text().$type<ListingStatus>().notNull().default("pending_review"),
    rejectionReason: text(),
    unavailableReason: text(),
    submittedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("marketplace_listings_saved_scent_unique").on(t.savedScentId),
    index("marketplace_listings_status_idx").on(t.status),
    index("marketplace_listings_seller_idx").on(t.sellerId),
    check("marketplace_listings_status_check", oneOf(t.status, LISTING_STATUSES)),
    check("marketplace_listings_markup_check", sql`${t.creatorMarkupKobo} > 0`),
    check(
      "marketplace_listings_description_check",
      sql`char_length(${t.description}) <= ${sql.raw(String(LISTING_DESCRIPTION_MAX))}`,
    ),
    check(
      "marketplace_listings_rejection_reason_check",
      sql`${t.status} <> 'rejected' or coalesce(btrim(${t.rejectionReason}), '') <> ''`,
    ),
  ],
);
