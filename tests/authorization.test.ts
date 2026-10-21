// The Authorization Rules from the Tech Plan (§3). Each rule becomes a real test against
// Postgres in the ticket that builds the matching DAL module. Covered so far: profiles,
// roles and notifications (tests/server/auth.test.ts, profiles-notifications.test.ts) and
// scent ownership and sharing (tests/server/scents.test.ts, library.test.ts), and order
// access and redaction (tests/server/checkout.test.ts), products (products.test.ts) and
// marketplace listings (marketplace.test.ts).
import { describe, it } from "vitest";

describe("authorization rules", () => {
  describe("saved_scents (T3, T4)", () => {
    it.todo("admins can read all scents");
  });

  describe("marketplace_listings (T7, T8)", () => {
    it.todo("only admins can approve or reject");
    it.todo("only the system can move a listing to or from unavailable");
  });

  describe("orders and order_items (T5)", () => {
    it.todo("admins can transition all orders");
  });

  describe("catalog (T9)", () => {
    it.todo("only admins can write ingredients and bottle options");
  });

  describe("system data (T5, T9, T11)", () => {
    it.todo("only the system writes reservations, ledger entries, notifications, webhook events and outbox rows");
    it.todo("sellers can read only their own ledger entries");
    it.todo("the public can read only public platform settings");
    it.todo("the public can read only active shipping zones");
  });
});
