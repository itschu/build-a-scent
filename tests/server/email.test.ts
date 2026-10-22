import { eq } from "drizzle-orm";
import type { EmailTransport } from "@/server/email";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { deliverEmail, queueEmail, setEmailTransportForTests } from "@/server/email";
import { renderEmail } from "@/server/email/templates";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

function capturingTransport(fail = false) {
  const sent: Array<{ to: string; subject: string }> = [];
  const transport = {
    sendMail: async (mail: { to: string; subject: string }) => {
      if (fail) throw new Error("Resend down");
      sent.push({ to: mail.to, subject: mail.subject });
      return {};
    },
  } as unknown as EmailTransport;
  return { transport, sent };
}

describe("email templates", () => {
  it("escapes user-provided values in HTML", () => {
    const email = renderEmail("verify_email", { name: "<script>x</script>", url: "https://example.com/v?a=1&b=2" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("a=1&amp;b=2");
  });
});

describe.skipIf(!testDatabaseUrl)("email outbox", () => {
  let conn: Connection;

  beforeAll(async () => {
    conn = await freshTestDatabase();
  });

  afterEach(() => setEmailTransportForTests(undefined));
  afterAll(async () => {
    await conn?.close();
  });

  const input = { to: "buyer@example.com", template: "test_email" as const, payload: { sentBy: "tests" } };

  it("queues each dedupe key once and sends it once", async () => {
    const { transport, sent } = capturingTransport();
    setEmailTransportForTests(transport);
    const id = await queueEmail(getDb(), { ...input, dedupeKey: "once" });
    expect(await queueEmail(getDb(), { ...input, dedupeKey: "once" })).toBeNull();

    expect(await deliverEmail(id!)).toBe("sent");
    expect(await deliverEmail(id!)).toBe("skipped");
    expect(sent).toEqual([{ to: "buyer@example.com", subject: "Build a Scent test email" }]);
  });

  it("records failures with backoff for the retry job", async () => {
    setEmailTransportForTests(capturingTransport(true).transport);
    const id = await queueEmail(getDb(), { ...input, dedupeKey: "fails" });
    expect(await deliverEmail(id!)).toBe("failed");
    const [row] = await conn.db.select().from(conn.schema.emailOutbox).where(eq(conn.schema.emailOutbox.id, id!));
    expect(row).toMatchObject({ status: "failed", attempts: 1, lastError: "Resend down" });
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

    const { transport, sent } = capturingTransport();
    setEmailTransportForTests(transport);
    expect(await deliverEmail(id!)).toBe("sent");
    expect(sent).toHaveLength(1);
  });
});
