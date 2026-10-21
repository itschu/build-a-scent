// The Authorization Rules from the Tech Plan (§3). Each rule becomes a real test against
// Postgres in the ticket that builds the matching DAL module.
import { describe, it } from "vitest";

describe("authorization rules", () => {
  describe("saved_scents (T3, T4)", () => {
    it.todo("owners can read and write their own scents; other users cannot");
    it.todo("admins can read all scents");
    it.todo("the public can read a scent only via a valid share token while sharing is on");
    it.todo("a shared scent with an approved listing never exposes its formula");
  });

  describe("marketplace_listings (T7, T8)", () => {
    it.todo("the public can read approved listings as a note profile only");
    it.todo("sellers can read their own listings and edit description, markup and featured notes");
    it.todo("only admins can approve or reject");
    it.todo("only the system can move a listing to or from unavailable");
  });

  describe("orders and order_items (T5)", () => {
    it.todo("users can read their own orders");
    it.todo("guests can read an order only with checkout context or order number + email");
    it.todo("guest views of marketplace items are redacted");
    it.todo("admins can read and transition all orders");
  });

  describe("profiles and users (T2)", () => {
    it.todo("users can read and update their own profile");
    it.todo("the public can read only display name, avatar and bio of sellers with approved listings");
    it.todo("users cannot change their own role");
  });

  describe("catalog (T6, T9)", () => {
    it.todo("the public can read only active ingredients, bottle options, products and variants");
    it.todo("only admins can write catalog data");
  });

  describe("system data (T5, T9, T11)", () => {
    it.todo("only the system writes reservations, ledger entries, notifications, webhook events and outbox rows");
    it.todo("sellers can read only their own ledger entries");
    it.todo("users can read and mark read only their own notifications");
    it.todo("the public can read only public platform settings");
    it.todo("the public can read only active shipping zones");
  });
});
