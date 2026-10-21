import type { Metadata } from "next";
import { Suspense } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password · Build a Scent" };

export default function ResetPasswordPage() {
  return (
    <>
      <Eyebrow>Account recovery</Eyebrow>
      <h1 className="mb-6 font-serif text-2xl text-cream">Choose a new password</h1>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
