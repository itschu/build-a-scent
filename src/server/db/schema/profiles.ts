import { bigint, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_helpers";
import { users } from "./auth";

export const profiles = pgTable("profiles", {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text(),
  // The only identity field shown publicly (marketplace creator name).
  displayName: text(),
  bio: text(),
  avatarUrl: text(),
  phone: text(),
  deliveryAddress: text(),
  city: text(),
  state: text(),
  // Cached sum of `available` ledger entries; recomputed with every ledger change.
  sellerAvailableKobo: bigint({ mode: "number" }).notNull().default(0),
  ...timestamps,
});
