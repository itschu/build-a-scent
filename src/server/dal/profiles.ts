import "server-only";
import { and, eq, exists, isNull } from "drizzle-orm";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validation/profile";
import { getDb, schema, type Db, type Tx } from "@/server/db";
import { assertSignedIn, type Actor } from "./actor";

/** Creates the profile row for a new user; a no-op if it already exists. */
export async function ensureProfile(executor: Db | Tx, input: { userId: string; fullName?: string | null }) {
  await executor
    .insert(schema.profiles)
    .values({ userId: input.userId, fullName: input.fullName ?? null })
    .onConflictDoNothing({ target: schema.profiles.userId });
}

export type OwnProfile = {
  email: string;
  emailVerified: boolean;
  fullName: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  phone: string | null;
  deliveryAddress: string | null;
  city: string | null;
  state: string | null;
};

export async function getOwnProfile(actor: Actor): Promise<OwnProfile> {
  assertSignedIn(actor);
  const db = getDb();
  await ensureProfile(db, { userId: actor.userId });
  const [row] = await db
    .select({
      email: schema.users.email,
      emailVerified: schema.users.emailVerified,
      fullName: schema.profiles.fullName,
      displayName: schema.profiles.displayName,
      bio: schema.profiles.bio,
      avatarUrl: schema.profiles.avatarUrl,
      phone: schema.profiles.phone,
      deliveryAddress: schema.profiles.deliveryAddress,
      city: schema.profiles.city,
      state: schema.profiles.state,
    })
    .from(schema.profiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
    .where(eq(schema.profiles.userId, actor.userId));
  return row;
}

/** Updates the actor's own profile. Role, email and earnings are not editable here. */
export async function updateOwnProfile(actor: Actor, input: ProfileUpdateInput) {
  assertSignedIn(actor);
  const data = profileUpdateSchema.parse(input);
  const db = getDb();
  await ensureProfile(db, { userId: actor.userId });
  await db.update(schema.profiles).set(data).where(eq(schema.profiles.userId, actor.userId));
}

export type PublicProfile = { displayName: string; avatarUrl: string | null; bio: string | null };

/**
 * A creator's public identity. Only sellers with an approved listing have one, and only
 * the display name, avatar and bio are ever returned.
 */
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const db = getDb();
  const [row] = await db
    .select({
      displayName: schema.profiles.displayName,
      fullName: schema.profiles.fullName,
      avatarUrl: schema.profiles.avatarUrl,
      bio: schema.profiles.bio,
    })
    .from(schema.profiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
    .where(
      and(
        eq(schema.profiles.userId, userId),
        // Blocked sellers have no public profile.
        isNull(schema.users.bannedAt),
        exists(
          db
            .select({ id: schema.marketplaceListings.id })
            .from(schema.marketplaceListings)
            .where(
              and(
                eq(schema.marketplaceListings.sellerId, userId),
                eq(schema.marketplaceListings.status, "approved"),
              ),
            ),
        ),
      ),
    );
  if (!row) return null;
  return {
    displayName: publicNameFor(row),
    avatarUrl: row.avatarUrl,
    bio: row.bio,
  };
}

/** Display name, falling back to the first name so a full name is never shown publicly. */
export function publicNameFor(profile: { displayName: string | null; fullName: string | null }): string {
  if (profile.displayName) return profile.displayName;
  const first = profile.fullName?.trim().split(/\s+/)[0];
  return first || "Anonymous creator";
}
