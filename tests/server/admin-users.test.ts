import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth } from "@/server/auth/config";
import { initiateCheckout } from "@/server/checkout/initiate";
import { getDb } from "@/server/db";
import { AuthorizationError, ValidationError } from "@/server/dal/actor";
import { updateSettings } from "@/server/dal/admin-settings";
import {
  blockUser,
  deleteUser,
  getUserForAdmin,
  inviteUser,
  listUsersForAdmin,
  setEmailVerified,
  setUserRole,
  signOutEverywhere,
  unblockUser,
  updateUserDetails,
  userListQuerySchema,
} from "@/server/dal/admin-users";
import { getPublicListing, listMarketplace, submitListing } from "@/server/dal/marketplace";
import { approveListing } from "@/server/dal/moderation";
import { saveScent } from "@/server/dal/scents";
import { setEmailTransportForTests } from "@/server/email";
import { defaultSettings } from "@/lib/settings";
import { seed } from "../../scripts/seed-data";
import { loadCatalog } from "../support/catalog";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";
import { actorFor, createUser } from "../support/factories";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("admin user management", () => {
  let conn: Connection;
  let catalog: Awaited<ReturnType<typeof loadCatalog>>;
  let auth: ReturnType<typeof createAuth>;
  let admin: ReturnType<typeof actorFor>;

  beforeAll(async () => {
    conn = await freshTestDatabase();
    await seed(conn.db, { sampleData: true });
    catalog = await loadCatalog(conn.db);
    auth = createAuth(getDb());
    admin = actorFor(await createUser(conn.db, { role: "admin", name: "Head Admin" }));
    setEmailTransportForTests({ sendMail: async () => ({}) });
  });

  afterAll(async () => {
    setEmailTransportForTests(undefined);
    await conn?.close();
  });

  const query = (q: Record<string, unknown> = {}) => userListQuerySchema.parse(q);
  let n = 0;
  /** A real account with a password, signed in once (so it has a session). */
  async function member(name = `Member ${++n}`) {
    const email = `member-${n}-${Date.now()}@example.com`;
    const { user } = await auth.api.signUpEmail({ body: { name, email, password: "correct horse" } });
    await auth.api.signInEmail({ body: { email, password: "correct horse" } });
    await conn.db.update(conn.schema.users).set({ emailVerified: true }).where(eq(conn.schema.users.id, user.id));
    return { id: user.id, email, actor: actorFor({ id: user.id, role: "user", emailVerified: true }) };
  }
  const sessionsOf = (userId: string) => conn.db.select().from(conn.schema.sessions).where(eq(conn.schema.sessions.userId, userId));

  it("is admin-only", async () => {
    const someone = await member();
    await expect(listUsersForAdmin(someone.actor, query())).rejects.toBeInstanceOf(AuthorizationError);
    await expect(blockUser(someone.actor, admin.userId)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("lists, searches and filters users", async () => {
    const amaka = await member("Amaka Searchable");
    const all = await listUsersForAdmin(admin, query());
    expect(all.total).toBeGreaterThanOrEqual(2);
    const found = await listUsersForAdmin(admin, query({ q: "searchable" }));
    expect(found.rows.map((r) => r.id)).toEqual([amaka.id]);
    expect(found.rows[0]).toMatchObject({ orderCount: 0, spendKobo: 0, liveListings: 0 });
    const admins = await listUsersForAdmin(admin, query({ role: "admin" }));
    expect(admins.rows.every((r) => r.role === "admin")).toBe(true);
  });

  it("blocks a user: signed out, can't sign in, listings hidden; unblocking restores them", async () => {
    const seller = await member("Blocked Seller");
    const { id: scentId } = await saveScent(seller.actor, { name: "Hidden", formula: ["Oud", "Rose", "Mint"].map(catalog.entry), bottleOptionId: catalog.bottle(50, "spray").id });
    const { id: listingId } = await submitListing(seller.actor, { description: "", creatorMarkupKobo: 500_000, featuredIngredientIds: [], scentId });
    await approveListing(admin, listingId);
    expect(await getPublicListing(listingId)).not.toBeNull();
    expect(await sessionsOf(seller.id)).not.toHaveLength(0);

    await blockUser(admin, seller.id, "Spam listings");
    expect(await sessionsOf(seller.id)).toHaveLength(0);
    await expect(auth.api.signInEmail({ body: { email: seller.email, password: "correct horse" } })).rejects.toThrow(/suspended/);
    expect(await getPublicListing(listingId)).toBeNull();
    expect((await listMarketplace()).map((l) => l.id)).not.toContain(listingId);
    const blocked = await listUsersForAdmin(admin, query({ status: "blocked" }));
    expect(blocked.rows.map((r) => r.id)).toContain(seller.id);

    await unblockUser(admin, seller.id);
    expect(await getPublicListing(listingId)).not.toBeNull();
    await expect(auth.api.signInEmail({ body: { email: seller.email, password: "correct horse" } })).resolves.toBeTruthy();

    const detail = await getUserForAdmin(admin, seller.id);
    expect(detail.history.map((h) => h.action)).toEqual(["unblocked", "blocked"]);
    expect(detail.history[1]).toMatchObject({ details: { reason: "Spam listings" }, actorName: "Head Admin" });
  });

  it("won't approve a blocked seller's listing, and checkout refuses their listings", async () => {
    const seller = await member();
    const { id: scentId } = await saveScent(seller.actor, { name: "Pending", formula: ["Amber", "Peony", "Lemon"].map(catalog.entry), bottleOptionId: catalog.bottle(50, "spray").id });
    const { id: listingId } = await submitListing(seller.actor, { description: "", creatorMarkupKobo: 500_000, featuredIngredientIds: [], scentId });
    await blockUser(admin, seller.id);
    await expect(approveListing(admin, listingId)).rejects.toThrow(/seller is blocked/);
    await unblockUser(admin, seller.id);
    await approveListing(admin, listingId);
    await blockUser(admin, seller.id);
    const buyer = actorFor(await createUser(conn.db));
    const result = await initiateCheckout(buyer, {
      lines: [{ type: "marketplace_listing", key: "l", listingId, quantity: 1, displayPriceKobo: 1 }],
      delivery: { fullName: "Ada", email: "ada@example.com", phone: "08030000000", address: "1 Marina", city: "Lagos", state: "Lagos" },
      gateway: "paystack",
    });
    expect(result).toMatchObject({ kind: "changed", issues: [{ kind: "unavailable" }] });
  });

  it("protects admins: no self-changes, no blocking admins, never zero admins", async () => {
    const other = actorFor(await createUser(conn.db, { role: "admin" }));
    await expect(blockUser(admin, admin.userId)).rejects.toThrow(/your own account/);
    await expect(setUserRole(admin, admin.userId, "user")).rejects.toThrow(/your own account/);
    await expect(blockUser(admin, other.userId)).rejects.toThrow(/Remove their admin role/);
    await expect(deleteUser(admin, other.userId)).rejects.toThrow(/Remove their admin role/);
    await setUserRole(admin, other.userId, "user");
    await expect(blockUser(admin, other.userId)).resolves.toBeUndefined();
  });

  it("edits details; a new email must be verified again and must be unique", async () => {
    const someone = await member();
    const taken = await member();
    await updateUserDetails(admin, someone.id, { name: "Renamed", email: "Renamed@Example.com", displayName: "Rene", phone: "0803" });
    const [user] = await conn.db.select().from(conn.schema.users).where(eq(conn.schema.users.id, someone.id));
    expect(user).toMatchObject({ name: "Renamed", email: "renamed@example.com", emailVerified: false });
    await expect(updateUserDetails(admin, someone.id, { name: "X", email: taken.email })).rejects.toThrow(/already uses/);
    await setEmailVerified(admin, someone.id, true);
    const [verified] = await conn.db.select().from(conn.schema.users).where(eq(conn.schema.users.id, someone.id));
    expect(verified.emailVerified).toBe(true);
  });

  it("signs a user out everywhere", async () => {
    const someone = await member();
    await signOutEverywhere(admin, someone.id);
    expect(await sessionsOf(someone.id)).toHaveLength(0);
  });

  it("deletes by anonymising: details and sign-ins removed, orders kept, account read-only", async () => {
    const someone = await member("Delete Me");
    await conn.db.insert(conn.schema.orders).values({
      orderNumber: `BAS-DEL-${n}`,
      userId: someone.id,
      email: someone.email,
      paymentGateway: "paystack",
      subtotalKobo: 100,
      shippingFeeKobo: 0,
      totalKobo: 100,
      deliveryAddress: { fullName: "Delete Me", phone: "0803", address: "1 Road", city: "Lagos", state: "Lagos" },
    });
    await deleteUser(admin, someone.id);
    const [user] = await conn.db.select().from(conn.schema.users).where(eq(conn.schema.users.id, someone.id));
    expect(user.name).toBe("Deleted user");
    expect(user.email).toMatch(/@deleted\.invalid$/);
    expect(user.deletedAt).not.toBeNull();
    expect(await conn.db.select().from(conn.schema.accounts).where(eq(conn.schema.accounts.userId, someone.id))).toHaveLength(0);
    expect(await conn.db.select().from(conn.schema.orders).where(eq(conn.schema.orders.userId, someone.id))).toHaveLength(1);
    await expect(auth.api.signInEmail({ body: { email: someone.email, password: "correct horse" } })).rejects.toThrow();
    await expect(unblockUser(admin, someone.id)).rejects.toBeInstanceOf(ValidationError);
    expect((await listUsersForAdmin(admin, query({ status: "deleted" }))).rows.map((r) => r.id)).toContain(someone.id);
  });

  it("invites users even while sign-ups are paused, and emails a set-password link", async () => {
    await updateSettings(admin, { ...defaultSettings(), signups_enabled: false });
    try {
      await expect(
        auth.api.signUpEmail({ body: { name: "Walk In", email: "walk-in@example.com", password: "correct horse" } }),
      ).rejects.toThrow(/sign-ups are paused/);

      const { id } = await inviteUser(admin, { name: "Invited Person", email: "Invited@Example.com" });
      const [user] = await conn.db.select().from(conn.schema.users).where(eq(conn.schema.users.id, id));
      expect(user).toMatchObject({ email: "invited@example.com", emailVerified: true, role: "user" });
      await expect(inviteUser(admin, { name: "Again", email: "invited@example.com" })).rejects.toThrow(/already uses/);
      await new Promise((r) => setTimeout(r, 200));
      const emails = await conn.db.select().from(conn.schema.emailOutbox).where(eq(conn.schema.emailOutbox.toEmail, "invited@example.com"));
      expect(emails.map((e) => e.template)).toEqual(["set_password"]);
    } finally {
      await updateSettings(admin, defaultSettings());
    }
  });
});
