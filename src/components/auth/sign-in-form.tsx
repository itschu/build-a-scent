"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { authClient } from "@/lib/auth-client";
import { GoogleButton } from "./google-button";

export function SignInForm({ callbackURL, onSuccess }: { callbackURL: string; onSuccess: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) {
      setError(error.status === 429 ? "Too many attempts. Please wait a minute and try again." : "Incorrect email or password.");
      return;
    }
    onSuccess();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Email">
          {({ id }) => <Input id={id} name="email" type="email" autoComplete="email" required />}
        </Field>
        <Field label="Password">
          {({ id }) => <Input id={id} name="password" type="password" autoComplete="current-password" required />}
        </Field>
        <div className="flex items-center justify-between gap-4">
          <Button type="submit" pending={pending}>
            Sign in
          </Button>
          <Link href="/forgot-password" className="text-xs text-muted hover:text-gold">
            Forgot password?
          </Link>
        </div>
      </form>
      <div className="flex items-center gap-3 text-[0.65rem] uppercase tracking-label text-faint">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleButton callbackURL={callbackURL} onError={setError} />
    </div>
  );
}
