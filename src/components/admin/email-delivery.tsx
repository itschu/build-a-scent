"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { retryEmailAction, sendTestEmailAction } from "@/app/(admin)/admin/settings/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatDate } from "@/lib/dates";

type Undeliverable = { id: string; toEmail: string; template: string; lastError: string | null; attempts: number; updatedAt: Date };

export function EmailDelivery({ undeliverable }: { undeliverable: Undeliverable[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  return (
    <section id="email" className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-[0.7rem] uppercase tracking-label text-gold">Email delivery</h2>
        <Button
          size="sm"
          variant="ghost"
          pending={pending === "test"}
          onClick={async () => {
            setPending("test");
            const result = await sendTestEmailAction();
            setPending(null);
            toast(result.ok ? "Test email sent to your address." : result.error, { tone: result.ok ? "success" : "error" });
          }}
        >
          Send test email
        </Button>
      </div>
      <p className="text-xs text-muted">
        Failed emails are retried automatically with backoff. Ones that still fail after every retry are listed here.
      </p>
      {undeliverable.length === 0 ? (
        <p className="border border-line p-5 text-sm text-faint">Every email has been delivered.</p>
      ) : (
        <ul className="divide-y divide-line-soft border border-danger/40">
          {undeliverable.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="text-champagne">{e.template.replaceAll("_", " ")}</span> → {e.toEmail}
                <span className="block truncate text-xs text-danger">
                  {e.lastError} · {e.attempts} attempts · {formatDate(e.updatedAt)}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                pending={pending === e.id}
                onClick={async () => {
                  setPending(e.id);
                  const result = await retryEmailAction(e.id);
                  setPending(null);
                  if (!result.ok) return toast(result.error, { tone: "error" });
                  toast(result.data === "sent" ? "Email sent." : "Still failing; check the SMTP settings.", { tone: result.data === "sent" ? "success" : "error" });
                  router.refresh();
                }}
              >
                Retry
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
