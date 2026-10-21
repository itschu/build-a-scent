import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatNaira } from "@/lib/money";
import { isFakePayments } from "@/server/payments";
import { fakeTransactions } from "@/server/payments/fake";
import { completeFakePayment, type FakeOutcome } from "./actions";

export const metadata = { title: "Test payment", robots: { index: false } };

const OUTCOMES: Array<{ outcome: FakeOutcome; label: string }> = [
  { outcome: "success", label: "Pay successfully" },
  { outcome: "failed", label: "Decline payment" },
  { outcome: "success_no_webhook", label: "Pay, but delay the webhook" },
  { outcome: "wrong_amount", label: "Pay the wrong amount" },
];

// Local stand-in for the Paystack/Flutterwave hosted page (PAYMENTS_MODE=fake only).
export default function FakeGatewayPage({ searchParams }: PageProps<"/dev/fake-gateway">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <Suspense>
        <FakeGateway searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FakeGateway({ searchParams }: { searchParams: PageProps<"/dev/fake-gateway">["searchParams"] }) {
  const reference = String((await searchParams).reference ?? "");
  if (!isFakePayments()) notFound();
  const tx = fakeTransactions.get(reference);
  if (!tx) notFound();

  return (
    <div className="border border-dashed border-amethyst/60 p-8">
      <p className="mb-2 font-serif text-[0.7rem] uppercase tracking-display text-amethyst">Test mode · {tx.gateway}</p>
      <h1 className="mb-1 font-serif text-2xl text-cream">Simulated payment</h1>
      <p className="mb-8 text-sm text-muted">
        {reference} · {formatNaira(tx.amountKobo)}
      </p>
      <div className="flex flex-col gap-3">
        {OUTCOMES.map(({ outcome, label }) => (
          <form key={outcome} action={completeFakePayment.bind(null, reference, outcome)}>
            <button className="w-full border border-line px-4 py-3 text-left text-sm text-champagne hover:border-gold">{label}</button>
          </form>
        ))}
      </div>
    </div>
  );
}
