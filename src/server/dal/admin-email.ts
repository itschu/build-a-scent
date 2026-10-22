import "server-only";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import { deliverEmail, MAX_ATTEMPTS, sendEmail } from "@/server/email";
import { assertAdmin, NotFoundError, ValidationError, type Actor } from "./actor";

/** Emails that exhausted their automatic retries; an admin has to look at these. */
export async function listUndeliverableEmails(actor: Actor) {
  assertAdmin(actor);
  return getDb()
    .select({
      id: schema.emailOutbox.id,
      toEmail: schema.emailOutbox.toEmail,
      template: schema.emailOutbox.template,
      lastError: schema.emailOutbox.lastError,
      attempts: schema.emailOutbox.attempts,
      updatedAt: schema.emailOutbox.updatedAt,
    })
    .from(schema.emailOutbox)
    .where(and(eq(schema.emailOutbox.status, "failed"), gte(schema.emailOutbox.attempts, MAX_ATTEMPTS)))
    .orderBy(desc(schema.emailOutbox.updatedAt))
    .limit(50);
}

export async function countUndeliverableEmails(actor: Actor): Promise<number> {
  assertAdmin(actor);
  const [row] = await getDb()
    .select({ n: count() })
    .from(schema.emailOutbox)
    .where(and(eq(schema.emailOutbox.status, "failed"), gte(schema.emailOutbox.attempts, MAX_ATTEMPTS)));
  return row.n;
}

/** Gives an undeliverable email a fresh set of attempts and tries it now. */
export async function retryUndeliverableEmail(actor: Actor, id: string): Promise<"sent" | "failed" | "skipped"> {
  assertAdmin(actor);
  const updated = await getDb()
    .update(schema.emailOutbox)
    .set({ attempts: 0, nextAttemptAt: new Date() })
    .where(and(eq(schema.emailOutbox.id, id), eq(schema.emailOutbox.status, "failed")))
    .returning({ id: schema.emailOutbox.id });
  if (updated.length === 0) throw new NotFoundError("Email not found");
  return deliverEmail(id);
}

/** Sends a test email to the admin, synchronously, so delivery problems (e.g. a bad Resend key or unverified sender) show up immediately. */
export async function sendTestEmail(actor: Actor, to: string): Promise<void> {
  assertAdmin(actor);
  const dedupeKey = `test_email:${actor.userId}:${Date.now()}`;
  await sendEmail({ dedupeKey, to, template: "test_email", payload: { sentBy: to } });
  const [row] = await getDb().select().from(schema.emailOutbox).where(eq(schema.emailOutbox.dedupeKey, dedupeKey));
  if (row?.status !== "sent") throw new ValidationError(`The test email failed: ${row?.lastError ?? "unknown error"}`);
}
