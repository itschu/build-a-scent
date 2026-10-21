"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { authClient } from "@/lib/auth-client";

type Status = { tone: "success" | "error"; message: string } | null;

export function VerifyEmailBanner({ email }: { email: string }) {
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/account?verified=1" });
    setPending(false);
    setStatus(
      error
        ? { tone: "error", message: error.status === 429 ? "Please wait a minute before asking again." : "We couldn't send the email. Try again shortly." }
        : { tone: "success", message: `Verification email sent to ${email}.` },
    );
  }

  return (
    <div className="space-y-3 border border-gold-dim bg-plum/40 p-5">
      <p className="text-sm text-champagne">
        Please verify your email address. You&apos;ll need a verified email to list scents on the marketplace.
      </p>
      <Button variant="ghost" size="sm" pending={pending} onClick={resend}>
        Resend verification email
      </Button>
      {status && <Notice tone={status.tone}>{status.message}</Notice>}
    </div>
  );
}

export function EmailSettings({ currentEmail }: { currentEmail: string }) {
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newEmail = String(new FormData(event.currentTarget).get("newEmail")).trim();
    setPending(true);
    const { error } = await authClient.changeEmail({ newEmail, callbackURL: "/account?verified=1" });
    setPending(false);
    setStatus(
      error
        ? { tone: "error", message: error.message ?? "We couldn't change your email." }
        : { tone: "success", message: `Check ${newEmail} for a link to confirm the change.` },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-muted">
        Current email: <span className="text-champagne">{currentEmail}</span>
      </p>
      {status && <Notice tone={status.tone}>{status.message}</Notice>}
      <Field label="New email">{({ id }) => <Input id={id} name="newEmail" type="email" autoComplete="email" required />}</Field>
      <Button type="submit" variant="ghost" pending={pending}>
        Change email
      </Button>
    </form>
  );
}

export function PasswordSettings() {
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const newPassword = String(form.get("newPassword"));
    if (newPassword.length < 8) {
      setStatus({ tone: "error", message: "Use at least 8 characters for your new password." });
      return;
    }
    setPending(true);
    const { error } = await authClient.changePassword({
      currentPassword: String(form.get("currentPassword")),
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (error) {
      setStatus({
        tone: "error",
        message:
          error.code === "CREDENTIAL_ACCOUNT_NOT_FOUND"
            ? "You signed up with Google, so there's no password to change."
            : error.code === "INVALID_PASSWORD"
              ? "Your current password is incorrect."
              : (error.message ?? "We couldn't change your password."),
      });
      return;
    }
    formEl.reset();
    setStatus({ tone: "success", message: "Password changed. Other devices have been signed out." });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {status && <Notice tone={status.tone}>{status.message}</Notice>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Current password">
          {({ id }) => <Input id={id} name="currentPassword" type="password" autoComplete="current-password" required />}
        </Field>
        <Field label="New password">
          {({ id }) => <Input id={id} name="newPassword" type="password" autoComplete="new-password" required />}
        </Field>
      </div>
      <Button type="submit" variant="ghost" pending={pending}>
        Change password
      </Button>
    </form>
  );
}
