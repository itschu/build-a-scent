import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentProcessing } from "@/components/checkout/payment-processing";

export const metadata: Metadata = { title: "Confirming your payment · Build a Scent", robots: { index: false } };

export default function ProcessingPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <Suspense>
        <PaymentProcessing />
      </Suspense>
    </main>
  );
}
