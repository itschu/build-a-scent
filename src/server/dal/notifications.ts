import "server-only";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema, type Db, type Tx } from "@/server/db";
import { assertSignedIn, type Actor } from "./actor";

export type NotificationItem = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
};

/** System-only: notifications are created by server code, never by users. */
export async function createNotification(
  executor: Db | Tx,
  input: { userId: string; type: string; message: string; link?: string | null },
) {
  await executor.insert(schema.notifications).values({
    userId: input.userId,
    type: input.type,
    message: input.message,
    link: input.link ?? null,
  });
}

export async function listNotifications(actor: Actor, limit = 20): Promise<NotificationItem[]> {
  assertSignedIn(actor);
  return getDb()
    .select({
      id: schema.notifications.id,
      type: schema.notifications.type,
      message: schema.notifications.message,
      link: schema.notifications.link,
      isRead: schema.notifications.isRead,
      createdAt: schema.notifications.createdAt,
    })
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, actor.userId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(limit);
}

export async function countUnreadNotifications(actor: Actor): Promise<number> {
  assertSignedIn(actor);
  const [row] = await getDb()
    .select({ n: count() })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, actor.userId), eq(schema.notifications.isRead, false)));
  return row.n;
}

/** Marks the given notifications read; IDs belonging to other users are ignored. */
export async function markNotificationsRead(actor: Actor, ids: string[]) {
  assertSignedIn(actor);
  if (ids.length === 0) return;
  await getDb()
    .update(schema.notifications)
    .set({ isRead: true })
    .where(and(eq(schema.notifications.userId, actor.userId), inArray(schema.notifications.id, ids)));
}
