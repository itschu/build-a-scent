"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClasses } from "@/components/ui/button";

// Last-resort boundary: an unexpected error shows a calm page instead of a broken one.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="mb-3 font-serif text-[0.7rem] uppercase tracking-display text-gold">Something went wrong</p>
      <h1 className="mb-4 font-serif text-3xl text-cream">We hit a snag loading this page</h1>
      <p className="mb-8 max-w-md text-sm text-muted">
        Please try again. If you were paying, your payment is safe; you can check your order with its number and email.
        {error.digest && <span className="mt-2 block text-xs text-faint">Reference: {error.digest}</span>}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/orders/lookup" className={buttonClasses({ variant: "ghost" })}>
          Look up an order
        </Link>
      </div>
    </main>
  );
}
