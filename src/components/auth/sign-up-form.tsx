"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { authClient } from "@/lib/auth-client";
import { GoogleButton } from "./google-button";

const MIN_PASSWORD_LENGTH = 8;

export function SignUpForm({ callbackURL, onSuccess }: { callbackURL: string; onSuccess: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await authClient.signUp.email({
      name: String(form.get("name")).trim(),
      email: String(form.get("email")).trim(),
      password,
      // Where the email verification link lands.
      callbackURL: "/account?verified=1",
    });
    setPending(false);
    if (error) {
      setError(
        error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
          ? "An account with this email already exists. Sign in instead."
          : (error.message ?? "We couldn't create your account. Please try again."),
      );
      return;
    }
    onSuccess();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Name">
          {({ id }) => <Input id={id} name="name" autoComplete="name" required maxLength={120} />}
        </Field>
        <Field label="Email">
          {({ id }) => <Input id={id} name="email" type="email" autoComplete="email" required />}
        </Field>
        <Field label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              aria-describedby={describedBy}
              required
            />
          )}
        </Field>
        <Button type="submit" pending={pending}>
          Create account
        </Button>
      </form>
      <div className="flex items-center gap-3 text-[0.65rem] uppercase tracking-label text-faint">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <GoogleButton callbackURL={callbackURL} onError={setError} />
    </div>
  );
}
