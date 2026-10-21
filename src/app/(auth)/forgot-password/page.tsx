import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset your password · Build a Scent" };

export default function ForgotPasswordPage() {
  return (
    <>
      <Eyebrow>Account recovery</Eyebrow>
      <h1 className="mb-2 font-serif text-2xl text-cream">Forgot your password?</h1>
      <p className="mb-6 text-sm text-muted">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <ForgotPasswordForm />
    </>
  );
}
