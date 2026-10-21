"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email: String(new FormData(event.currentTarget).get("email")).trim(),
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error?.status === 429) setError("Too many requests. Please wait a minute and try again.");
    // Same message whether or not the account exists, so emails can't be probed.
    else setSent(true);
  }

  if (sent) {
    return (
      <Notice tone="success">
        If an account exists for that email, a reset link is on its way. It expires in 1 hour.{" "}
        <Link href="/sign-in" className="underline">
          Back to sign in
        </Link>
      </Notice>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Email">{({ id }) => <Input id={id} name="email" type="email" autoComplete="email" required />}</Field>
      <Button type="submit" pending={pending}>
        Send reset link
      </Button>
    </form>
  );
}
