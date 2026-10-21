"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!token || params.get("error")) {
    return (
      <Notice tone="error">
        This reset link is invalid or has expired.{" "}
        <Link href="/forgot-password" className="underline">
          Request a new one
        </Link>
      </Notice>
    );
  }

  if (done) {
    return (
      <Notice tone="success">
        Your password has been changed and you&apos;ve been signed out everywhere.{" "}
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>
      </Notice>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== String(form.get("confirm"))) {
      setError("The passwords don't match.");
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword, token: token! });
    setPending(false);
    if (error) setError("This reset link is invalid or has expired. Request a new one.");
    else setDone(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`}>
        {({ id, describedBy }) => (
          <Input id={id} name="password" type="password" autoComplete="new-password" aria-describedby={describedBy} required />
        )}
      </Field>
      <Field label="Confirm password">
        {({ id }) => <Input id={id} name="confirm" type="password" autoComplete="new-password" required />}
      </Field>
      <Button type="submit" pending={pending}>
        Save password
      </Button>
    </form>
  );
}
