import "server-only";
import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { env } from "@/env";
import { USER_ROLES, type UserRole } from "@/lib/domain";
import { getAuth } from "@/server/auth";
import { getDb, schema, type Tx } from "@/server/db";
import { assertAdmin, NotFoundError, ValidationError, type Actor, type SignedInActor } from "./actor";
import { SOLD_STATUSES } from "./analytics";
import { ensureProfile } from "./profiles";

export const USER_STATUS_FILTERS = ["all", "active", "unverified", "blocked", "deleted"] as const;
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];
export const USERS_PAGE_SIZE = 25;

const u = schema.users;

// Paid orders and spend per user, as correlated subqueries so the list stays one query.
const orderCountSql = sql<number>`(select count(*)::int from ${schema.orders} where ${schema.orders.userId} = ${u.id} and ${inArray(schema.orders.status, SOLD_STATUSES)})`;
const spendSql = sql<number>`(select coalesce(sum(${schema.orders.totalKobo}), 0)::bigint from ${schema.orders} where ${schema.orders.userId} = ${u.id} and ${inArray(schema.orders.status, SOLD_STATUSES)})`.mapWith(Number);
const liveListingsSql = sql<number>`(select count(*)::int from ${schema.marketplaceListings} where ${schema.marketplaceListings.sellerId} = ${u.id} and ${schema.marketplaceListings.status} = 'approved')`;

function statusWhere(status: UserStatusFilter): SQL | undefined {
  switch (status) {
    case "all":
      return isNull(u.deletedAt);
    case "active":
      return and(isNull(u.deletedAt), isNull(u.bannedAt));
    case "unverified":
      return and(isNull(u.deletedAt), eq(u.emailVerified, false));
    case "blocked":
      return and(isNull(u.deletedAt), isNotNull(u.bannedAt));
    case "deleted":
      return isNotNull(u.deletedAt);
  }
}

export const userListQuerySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  role: z.enum(["all", ...USER_ROLES]).catch("all"),
  status: z.enum(USER_STATUS_FILTERS).catch("all"),
  page: z.coerce.number().int().min(1).catch(1),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

/** Users for the admin list: search by name or email, filter by role and status, newest first. */
export async function listUsersForAdmin(actor: Actor, query: UserListQuery) {
  assertAdmin(actor);
  const like = `%${query.q.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const where = and(
    statusWhere(query.status),
    query.role === "all" ? undefined : eq(u.role, query.role),
    query.q ? or(ilike(u.name, like), ilike(u.email, like)) : undefined,
  );
  const db = getDb();
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        emailVerified: u.emailVerified,
        bannedAt: u.bannedAt,
        deletedAt: u.deletedAt,
        createdAt: u.createdAt,
        orderCount: orderCountSql,
        spendKobo: spendSql,
        liveListings: liveListingsSql,
      })
      .from(u)
      .where(where)
      .orderBy(desc(u.createdAt))
      .limit(USERS_PAGE_SIZE)
      .offset((query.page - 1) * USERS_PAGE_SIZE),
    db.select({ total: count() }).from(u).where(where),
  ]);
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)) };
}

export type AdminUserRow = Awaited<ReturnType<typeof listUsersForAdmin>>["rows"][number];

/** Everything an admin needs about one user: account, profile, activity and history. */
export async function getUserForAdmin(actor: Actor, id: string) {
  assertAdmin(actor);
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) throw new NotFoundError("User not found");
  const userId = parsedId.data;
  const db = getDb();
  const [row] = await db
    .select({ user: u, profile: schema.profiles, orderCount: orderCountSql, spendKobo: spendSql })
    .from(u)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, u.id))
    .where(eq(u.id, userId));
  if (!row) throw new NotFoundError("User not found");

  const actorUser = sql<string | null>`(select ${u.name} from ${u} where ${u.id} = ${schema.adminAuditLog.actorId})`;
  const [orders, scents, listings, history, sessions, credential] = await Promise.all([
    db
      .select({
        id: schema.orders.id,
        orderNumber: schema.orders.orderNumber,
        status: schema.orders.status,
        totalKobo: schema.orders.totalKobo,
        createdAt: schema.orders.createdAt,
      })
      .from(schema.orders)
      .where(eq(schema.orders.userId, userId))
      .orderBy(desc(schema.orders.createdAt))
      .limit(20),
    db
      .select({ status: schema.savedScents.status, n: count() })
      .from(schema.savedScents)
      .where(eq(schema.savedScents.userId, userId))
      .groupBy(schema.savedScents.status),
    db
      .select({
        id: schema.marketplaceListings.id,
        status: schema.marketplaceListings.status,
        scentName: schema.savedScents.name,
        submittedAt: schema.marketplaceListings.submittedAt,
      })
      .from(schema.marketplaceListings)
      .innerJoin(schema.savedScents, eq(schema.savedScents.id, schema.marketplaceListings.savedScentId))
      .where(eq(schema.marketplaceListings.sellerId, userId))
      .orderBy(desc(schema.marketplaceListings.submittedAt)),
    db
      .select({
        id: schema.adminAuditLog.id,
        action: schema.adminAuditLog.action,
        details: schema.adminAuditLog.details,
        createdAt: schema.adminAuditLog.createdAt,
        actorName: actorUser,
      })
      .from(schema.adminAuditLog)
      .where(eq(schema.adminAuditLog.targetUserId, userId))
      .orderBy(desc(schema.adminAuditLog.createdAt))
      .limit(30),
    db.select({ n: count() }).from(schema.sessions).where(eq(schema.sessions.userId, userId)),
    db
      .select({ providerId: schema.accounts.providerId })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId)),
  ]);
  return {
    user: row.user,
    profile: row.profile,
    stats: {
      orderCount: row.orderCount,
      spendKobo: row.spendKobo,
      savedScents: scents.find((s) => s.status === "saved")?.n ?? 0,
      drafts: scents.find((s) => s.status === "draft")?.n ?? 0,
      activeSessions: sessions[0]?.n ?? 0,
    },
    signInMethods: credential.map((a) => (a.providerId === "credential" ? "Email & password" : a.providerId === "google" ? "Google" : a.providerId)),
    orders,
    listings,
    history,
  };
}

export type AdminUserDetail = Awaited<ReturnType<typeof getUserForAdmin>>;

// --- Changes ---------------------------------------------------------------------------

async function audit(tx: Tx, actor: SignedInActor, targetUserId: string, action: string, details: Record<string, unknown> = {}) {
  await tx.insert(schema.adminAuditLog).values({ actorId: actor.userId, targetUserId, action, details });
}

/** Loads the target for a change; deleted accounts are read-only. */
async function editableUser(tx: Tx, id: string) {
  const [user] = await tx.select().from(u).where(eq(u.id, z.uuid().parse(id))).for("update");
  if (!user) throw new NotFoundError("User not found");
  if (user.deletedAt) throw new ValidationError("This account has been deleted and can't be changed.");
  return user;
}

function assertNotSelf(actor: SignedInActor, userId: string, what: string) {
  if (actor.userId === userId) throw new ValidationError(`You can't ${what} your own account.`);
}

function assertNotAdmin(user: { role: UserRole }, what: string) {
  if (user.role === "admin") throw new ValidationError(`Remove their admin role before you ${what} this account.`);
}

const emailSchema = z.email("Enter a valid email address").transform((e) => e.trim().toLowerCase());

async function assertEmailFree(tx: Tx, email: string, exceptId?: string) {
  const [taken] = await tx
    .select({ id: u.id })
    .from(u)
    .where(and(sql`lower(${u.email}) = ${email}`, exceptId ? ne(u.id, exceptId) : undefined));
  if (taken) throw new ValidationError("Another account already uses that email address.");
}

export const userDetailsSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  email: emailSchema,
  displayName: z.string().trim().max(60).nullish(),
  phone: z.string().trim().max(30).nullish(),
});
export type UserDetailsInput = z.input<typeof userDetailsSchema>;

/** Edits account and profile details. A changed email must be verified again. */
export async function updateUserDetails(actor: Actor, id: string, input: UserDetailsInput): Promise<void> {
  assertAdmin(actor);
  const data = userDetailsSchema.parse(input);
  await getDb().transaction(async (tx) => {
    const user = await editableUser(tx, id);
    const emailChanged = user.email.toLowerCase() !== data.email;
    if (emailChanged) await assertEmailFree(tx, data.email, user.id);
    await tx
      .update(u)
      .set({ name: data.name, email: data.email, ...(emailChanged ? { emailVerified: false } : {}) })
      .where(eq(u.id, user.id));
    await ensureProfile(tx, { userId: user.id, fullName: data.name });
    await tx
      .update(schema.profiles)
      .set({ displayName: data.displayName || null, phone: data.phone || null })
      .where(eq(schema.profiles.userId, user.id));
    const changes: Record<string, unknown> = {};
    if (user.name !== data.name) changes.name = { from: user.name, to: data.name };
    if (emailChanged) changes.email = { from: user.email, to: data.email };
    await audit(tx, actor, user.id, "updated_details", changes);
  });
}

export async function setEmailVerified(actor: Actor, id: string, verified: boolean): Promise<void> {
  assertAdmin(actor);
  await getDb().transaction(async (tx) => {
    const user = await editableUser(tx, id);
    await tx.update(u).set({ emailVerified: verified }).where(eq(u.id, user.id));
    await audit(tx, actor, user.id, verified ? "verified_email" : "unverified_email");
  });
}

/** Grants or removes admin. You can't change your own role, and there's always one admin. */
export async function setUserRole(actor: Actor, id: string, role: UserRole): Promise<void> {
  assertAdmin(actor);
  const next = z.enum(USER_ROLES).parse(role);
  await getDb().transaction(async (tx) => {
    const user = await editableUser(tx, id);
    assertNotSelf(actor, user.id, "change the role of");
    if (user.bannedAt && next === "admin") throw new ValidationError("Unblock this account before making it an admin.");
    if (user.role === next) return;
    await tx.update(u).set({ role: next }).where(eq(u.id, user.id));
    await audit(tx, actor, user.id, "changed_role", { from: user.role, to: next });
  });
}

export const banReasonSchema = z.string().trim().max(500).optional();

/**
 * Blocks an account: they're signed out everywhere, can't sign in, and their marketplace
 * listings are hidden (listings aren't changed, so unblocking restores them as they were).
 */
export async function blockUser(actor: Actor, id: string, reason?: string): Promise<void> {
  assertAdmin(actor);
  const why = banReasonSchema.parse(reason) || null;
  await getDb().transaction(async (tx) => {
    const user = await editableUser(tx, id);
    assertNotSelf(actor, user.id, "block");
    assertNotAdmin(user, "block");
    if (user.bannedAt) return;
    await tx.update(u).set({ bannedAt: new Date(), banReason: why }).where(eq(u.id, user.id));
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
    await audit(tx, actor, user.id, "blocked", why ? { reason: why } : {});
  });
}

export async function unblockUser(actor: Actor, id: string): Promise<void> {
  assertAdmin(actor);
  await getDb().transaction(async (tx) => {
    const user = await editableUser(tx, id);
    if (!user.bannedAt) return;
    await tx.update(u).set({ bannedAt: null, banReason: null }).where(eq(u.id, user.id));
    await audit(tx, actor, user.id, "unblocked");
  });
}

/** Ends every session, so the user has to sign in again on all devices. */
export async function signOutEverywhere(actor: Actor, id: string): Promise<void> {
  assertAdmin(actor);
  await getDb().transaction(async (tx) => {
    const user = await editableUser(tx, id);
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
    await audit(tx, actor, user.id, "signed_out_everywhere");
  });
}

/** Emails a link to set or reset the password (it creates one for Google-only accounts). */
export async function sendPasswordLink(actor: Actor, id: string): Promise<void> {
  assertAdmin(actor);
  const email = await getDb().transaction(async (tx) => {
    const user = await editableUser(tx, id);
    if (user.bannedAt) throw new ValidationError("Unblock this account first.");
    await audit(tx, actor, user.id, "sent_password_link");
    return user.email;
  });
  await requestPasswordLink(email);
}

async function requestPasswordLink(email: string) {
  await getAuth().api.requestPasswordReset({ body: { email, redirectTo: `${env().APP_URL}/reset-password` } });
}

export const inviteUserSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  email: emailSchema,
  role: z.enum(USER_ROLES).default("user"),
});
export type InviteUserInput = z.input<typeof inviteUserSchema>;

/**
 * Creates an account (email already verified) and emails a link to set a password. Works
 * even while public sign-ups are paused.
 */
export async function inviteUser(actor: Actor, input: InviteUserInput): Promise<{ id: string }> {
  assertAdmin(actor);
  const data = inviteUserSchema.parse(input);
  const created = await getDb().transaction(async (tx) => {
    await assertEmailFree(tx, data.email);
    const [user] = await tx
      .insert(u)
      .values({ name: data.name, email: data.email, emailVerified: true, role: data.role })
      .returning({ id: u.id });
    await ensureProfile(tx, { userId: user.id, fullName: data.name });
    await audit(tx, actor, user.id, "created_account", { role: data.role });
    return user;
  });
  await requestPasswordLink(data.email);
  return created;
}

/**
 * Deletes an account by anonymising it: personal details are removed, sign-in methods and
 * sessions are deleted, listings are withdrawn and drafts discarded. Orders are kept (with
 * their delivery details) for accounting and refunds.
 */
export async function deleteUser(actor: Actor, id: string): Promise<void> {
  assertAdmin(actor);
  await getDb().transaction(async (tx) => {
    const user = await editableUser(tx, id);
    assertNotSelf(actor, user.id, "delete");
    assertNotAdmin(user, "delete");
    const now = new Date();
    await tx
      .update(u)
      .set({
        name: "Deleted user",
        email: `deleted-${user.id}@deleted.invalid`,
        emailVerified: false,
        image: null,
        bannedAt: user.bannedAt ?? now,
        banReason: "Account deleted",
        deletedAt: now,
      })
      .where(eq(u.id, user.id));
    await tx
      .update(schema.profiles)
      .set({ fullName: null, displayName: null, bio: null, avatarUrl: null, phone: null, deliveryAddress: null, city: null, state: null })
      .where(eq(schema.profiles.userId, user.id));
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
    await tx.delete(schema.accounts).where(eq(schema.accounts.userId, user.id));
    await tx
      .update(schema.marketplaceListings)
      .set({ status: "withdrawn" })
      .where(and(eq(schema.marketplaceListings.sellerId, user.id), ne(schema.marketplaceListings.status, "withdrawn")));
    await tx.delete(schema.savedScents).where(and(eq(schema.savedScents.userId, user.id), eq(schema.savedScents.status, "draft")));
    await tx.delete(schema.notifications).where(eq(schema.notifications.userId, user.id));
    await audit(tx, actor, user.id, "deleted_account", { email: user.email });
  });
}
