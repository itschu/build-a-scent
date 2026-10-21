import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthorizationError, GUEST } from "@/server/dal/actor";
import {
  countUnreadNotifications,
  createNotification,
  listNotifications,
  markNotificationsRead,
} from "@/server/dal/notifications";
import { getOwnProfile, getPublicProfile, updateOwnProfile } from "@/server/dal/profiles";
import { seed } from "../../scripts/seed-data";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";
import { actorFor, createUser } from "../support/factories";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

const blankProfile = {
  fullName: "",
  displayName: "",
  bio: "",
  avatarUrl: "",
  phone: "",
  deliveryAddress: "",
  city: "",
  state: "",
};

describe.skipIf(!testDatabaseUrl)("profiles and notifications DAL", () => {
  let conn: Connection;

  beforeAll(async () => {
    conn = await freshTestDatabase();
    await seed(conn.db, { sampleData: false });
  });

  afterAll(async () => {
    await conn?.close();
  });

  describe("profiles", () => {
    it("users can read and update their own profile", async () => {
      const user = await createUser(conn.db);
      const actor = actorFor(user);
      await updateOwnProfile(actor, {
        ...blankProfile,
        fullName: "Emeka Nwosu",
        displayName: "Emeka N.",
        phone: "+234 803 000 0000",
        city: "Lagos",
        state: "Lagos",
      });
      const profile = await getOwnProfile(actor);
      expect(profile).toMatchObject({ fullName: "Emeka Nwosu", displayName: "Emeka N.", state: "Lagos", bio: null });
    });

    it("rejects invalid input and guests", async () => {
      const actor = actorFor(await createUser(conn.db));
      await expect(updateOwnProfile(actor, { ...blankProfile, state: "Atlantis" })).rejects.toThrow();
      await expect(updateOwnProfile(actor, { ...blankProfile, avatarUrl: "http://insecure.example/a.png" })).rejects.toThrow();
      await expect(getOwnProfile(GUEST)).rejects.toBeInstanceOf(AuthorizationError);
    });

    it("exposes a public profile only for sellers with an approved listing, and only safe fields", async () => {
      const seller = await createUser(conn.db);
      await updateOwnProfile(actorFor(seller), {
        ...blankProfile,
        fullName: "Private Fullname",
        bio: "Nose for oud.",
        phone: "+234 800 000 0000",
      });
      expect(await getPublicProfile(seller.id)).toBeNull();

      const [bottle] = await conn.db.select().from(conn.schema.bottleOptions).limit(1);
      const [scent] = await conn.db
        .insert(conn.schema.savedScents)
        .values({ userId: seller.id, status: "saved", name: "Oud Nights", bottleOptionId: bottle.id, formulaHash: "h" })
        .returning();
      await conn.db.insert(conn.schema.marketplaceListings).values({
        savedScentId: scent.id,
        sellerId: seller.id,
        bottleOptionId: bottle.id,
        creatorMarkupKobo: 100_000,
        status: "approved",
      });

      expect(await getPublicProfile(seller.id)).toEqual({
        displayName: "Private",
        avatarUrl: null,
        bio: "Nose for oud.",
      });
    });
  });

  describe("notifications", () => {
    it("users read and mark read only their own notifications", async () => {
      const alice = await createUser(conn.db);
      const bob = await createUser(conn.db);
      await createNotification(conn.db, { userId: alice.id, type: "test", message: "For Alice" });
      await createNotification(conn.db, { userId: bob.id, type: "test", message: "For Bob" });

      const aliceItems = await listNotifications(actorFor(alice));
      expect(aliceItems.map((n) => n.message)).toEqual(["For Alice"]);
      const bobItems = await listNotifications(actorFor(bob));

      // Alice cannot mark Bob's notification read.
      await markNotificationsRead(actorFor(alice), [bobItems[0].id, aliceItems[0].id]);
      expect(await countUnreadNotifications(actorFor(alice))).toBe(0);
      expect(await countUnreadNotifications(actorFor(bob))).toBe(1);
      await expect(listNotifications(GUEST)).rejects.toBeInstanceOf(AuthorizationError);
    });
  });
});
