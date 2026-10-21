import "server-only";
import { and, eq, inArray, lte } from "drizzle-orm";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/env";
import { getDb, schema, type Db, type Tx } from "@/server/db";
import { isEmailTemplate, renderEmail, type EmailPayload, type EmailTemplate } from "./templates";

const MAX_ATTEMPTS = 6;

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const e = env();
  if (e.SMTP_HOST && e.SMTP_PORT && e.SMTP_USER && e.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_PORT === 465,
      auth: { user: e.SMTP_USER, pass: e.SMTP_PASS },
    });
  } else {
    // Development without SMTP: emails are logged instead of sent (production requires SMTP).
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

/** Testing hook: replace the transport (e.g. with a capturing one). */
export function setEmailTransportForTests(t: Transporter | undefined) {
  transporter = t;
}

/**
 * Adds an email to the outbox. Returns the row ID, or null when an email with the same
 * dedupe key already exists, so retried webhooks and double submits never send twice.
 * Call inside the transaction that causes the email, then deliver after commit.
 */
export async function queueEmail<T extends EmailTemplate>(
  executor: Db | Tx,
  input: { dedupeKey: string; to: string; template: T; payload: EmailPayload<T> },
): Promise<string | null> {
  const [row] = await executor
    .insert(schema.emailOutbox)
    .values({
      dedupeKey: input.dedupeKey,
      toEmail: input.to,
      template: input.template,
      payload: input.payload as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: schema.emailOutbox.dedupeKey })
    .returning({ id: schema.emailOutbox.id });
  return row?.id ?? null;
}

/** Exponential backoff for retries: 1, 2, 4, 8, 16 minutes. */
function nextAttemptDelayMs(attempts: number): number {
  return 60_000 * 2 ** Math.max(0, attempts - 1);
}

/**
 * Sends one queued email. Safe to call concurrently and repeatedly: only a pending row is
 * claimed (by bumping its attempt count), and a sent row is never sent again.
 */
export async function deliverEmail(id: string): Promise<"sent" | "failed" | "skipped"> {
  const db = getDb();
  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.emailOutbox)
      .where(and(eq(schema.emailOutbox.id, id), inArray(schema.emailOutbox.status, ["pending", "failed"])))
      .for("update", { skipLocked: true });
    if (!row || row.attempts >= MAX_ATTEMPTS) return null;
    await tx
      .update(schema.emailOutbox)
      .set({ attempts: row.attempts + 1 })
      .where(eq(schema.emailOutbox.id, id));
    return { ...row, attempts: row.attempts + 1 };
  });
  if (!claimed) return "skipped";

  try {
    if (!isEmailTemplate(claimed.template)) throw new Error(`Unknown template ${claimed.template}`);
    const rendered = renderEmail(claimed.template, claimed.payload as never);
    const info = await getTransporter().sendMail({
      from: env().EMAIL_FROM ?? "Build a Scent <no-reply@localhost>",
      to: claimed.toEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
    if (env().NODE_ENV === "development" && "message" in info) {
      console.info(`[email] ${claimed.template} → ${claimed.toEmail}\n${rendered.text}`);
    }
    await db
      .update(schema.emailOutbox)
      .set({ status: "sent", sentAt: new Date(), lastError: null })
      .where(eq(schema.emailOutbox.id, id));
    return "sent";
  } catch (error) {
    await db
      .update(schema.emailOutbox)
      .set({
        status: "failed",
        lastError: error instanceof Error ? error.message : String(error),
        nextAttemptAt: new Date(Date.now() + nextAttemptDelayMs(claimed.attempts)),
      })
      .where(eq(schema.emailOutbox.id, id));
    return "failed";
  }
}

/** Delivers emails queued by a committed transaction; failures are left for the retry job. */
export async function deliverEmails(ids: Array<string | null>): Promise<void> {
  for (const id of ids) {
    if (id) await deliverEmail(id);
  }
}

/** Queues and immediately attempts delivery, outside any transaction. */
export async function sendEmail<T extends EmailTemplate>(input: {
  dedupeKey: string;
  to: string;
  template: T;
  payload: EmailPayload<T>;
}): Promise<void> {
  const id = await queueEmail(getDb(), input);
  await deliverEmails([id]);
}

/** IDs of failed emails due for another attempt (used by the retry job). */
export async function dueEmailIds(limit = 50): Promise<string[]> {
  const rows = await getDb()
    .select({ id: schema.emailOutbox.id })
    .from(schema.emailOutbox)
    .where(
      and(
        inArray(schema.emailOutbox.status, ["pending", "failed"]),
        lte(schema.emailOutbox.nextAttemptAt, new Date()),
      ),
    )
    .limit(limit);
  return rows.map((r) => r.id);
}
