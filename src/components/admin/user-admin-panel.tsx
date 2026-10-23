"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  blockUserAction,
  deleteUserAction,
  sendPasswordLinkAction,
  setEmailVerifiedAction,
  setUserRoleAction,
  signOutEverywhereAction,
  unblockUserAction,
  updateUserDetailsAction,
} from "@/app/(admin)/admin/users/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";
import type { UserRole } from "@/lib/domain";

type Result = { ok: boolean; error?: string };

function useRunner() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<Result>, success: string): Promise<boolean> {
    setPending(key);
    setError(null);
    const result = await fn();
    setPending(null);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return false;
    }
    toast(success);
    router.refresh();
    return true;
  }
  return { pending, error, run };
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-surface p-5">
      <h2 className="mb-4 font-serif text-[0.7rem] uppercase tracking-label text-gold">{title}</h2>
      {children}
    </section>
  );
}

export function UserDetailsForm({
  user,
}: {
  user: { id: string; name: string; email: string; displayName: string; phone: string };
}) {
  const { pending, error, run } = useRunner();
  const [values, setValues] = useState(user);
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [key]: e.target.value });

  async function save(event: FormEvent) {
    event.preventDefault();
    await run(
      "save",
      () => updateUserDetailsAction(user.id, { name: values.name, email: values.email, displayName: values.displayName, phone: values.phone }),
      values.email.trim().toLowerCase() !== user.email.toLowerCase() ? "Saved. The new email needs verifying." : "Details saved.",
    );
  }

  return (
    <Panel title="Details">
      <form onSubmit={save} className="space-y-4" noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Name">{({ id }) => <Input id={id} value={values.name} onChange={set("name")} />}</Field>
        <Field label="Email" hint="Changing it marks the email as unverified">
          {({ id, describedBy }) => <Input id={id} type="email" value={values.email} onChange={set("email")} aria-describedby={describedBy} />}
        </Field>
        <Field label="Public creator name" hint="Shown on their marketplace listings">
          {({ id, describedBy }) => <Input id={id} value={values.displayName} onChange={set("displayName")} aria-describedby={describedBy} />}
        </Field>
        <Field label="Phone">{({ id }) => <Input id={id} type="tel" value={values.phone} onChange={set("phone")} />}</Field>
        <Button type="submit" size="sm" pending={pending === "save"}>
          Save details
        </Button>
      </form>
    </Panel>
  );
}

export function UserAccessControls({
  user,
  isSelf,
}: {
  user: { id: string; name: string; role: UserRole; emailVerified: boolean; blocked: boolean };
  isSelf: boolean;
}) {
  const router = useRouter();
  const { pending, error, run } = useRunner();
  const [blockOpen, setBlockOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const isAdmin = user.role === "admin";
  // Self-protection and "remove admin first" rules mirror the server's checks.
  const protectedReason = isSelf ? "You can't do this to your own account." : isAdmin ? "Remove their admin role first." : null;

  return (
    <div className="space-y-8">
      <Panel title="Access">
        {error && <Notice tone="error" className="mb-4">{error}</Notice>}
        <div className="space-y-5 text-sm">
          <Control
            title={user.emailVerified ? "Email verified" : "Email not verified"}
            hint={user.emailVerified ? "They can list scents for sale." : "Unverified users can't list scents for sale."}
          >
            <Button
              variant="ghost"
              size="sm"
              pending={pending === "verify"}
              onClick={() =>
                run(
                  "verify",
                  () => setEmailVerifiedAction(user.id, !user.emailVerified),
                  user.emailVerified ? "Email marked as unverified." : "Email marked as verified.",
                )
              }
            >
              {user.emailVerified ? "Mark unverified" : "Mark verified"}
            </Button>
          </Control>

          <Control title={isAdmin ? "Admin" : "Customer"} hint={isSelf ? "You can't change your own role." : isAdmin ? "Full access to this admin panel." : "No admin access."}>
            <Button
              variant="ghost"
              size="sm"
              disabled={isSelf}
              pending={pending === "role"}
              onClick={() =>
                run("role", () => setUserRoleAction(user.id, isAdmin ? "user" : "admin"), isAdmin ? "Admin role removed." : "They're now an admin.")
              }
            >
              {isAdmin ? "Remove admin" : "Make admin"}
            </Button>
          </Control>

          <Control title="Sessions" hint="Signs them out on every device.">
            <Button
              variant="ghost"
              size="sm"
              pending={pending === "signout"}
              onClick={() => run("signout", () => signOutEverywhereAction(user.id), "Signed out everywhere.")}
            >
              Sign out everywhere
            </Button>
          </Control>

          <Control title="Password" hint="Emails a link to set or reset their password (valid 1 hour).">
            <Button
              variant="ghost"
              size="sm"
              disabled={user.blocked}
              pending={pending === "password"}
              onClick={() => run("password", () => sendPasswordLinkAction(user.id), "Password link sent.")}
            >
              Send link
            </Button>
          </Control>
        </div>
      </Panel>

      <Panel title={user.blocked ? "Blocked" : "Block account"}>
        {user.blocked ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted">Unblocking lets them sign in again and puts their approved listings back on the marketplace.</p>
            <Button size="sm" pending={pending === "unblock"} onClick={() => run("unblock", () => unblockUserAction(user.id), "Account unblocked.")}>
              Unblock
            </Button>
          </div>
        ) : protectedReason ? (
          <p className="text-sm text-faint">{protectedReason}</p>
        ) : !blockOpen ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted">Signs them out, stops them signing in and hides their listings and share links. Orders aren&apos;t affected.</p>
            <Button variant="ghost" size="sm" onClick={() => setBlockOpen(true)}>
              Block…
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Reason (for your records)">
              {({ id }) => <Textarea id={id} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />}
            </Field>
            <div className="flex gap-3">
              <Button
                size="sm"
                pending={pending === "block"}
                onClick={async () => {
                  if (await run("block", () => blockUserAction(user.id, reason), "Account blocked.")) setBlockOpen(false);
                }}
              >
                Block {user.name}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setBlockOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Delete account">
        {protectedReason ? (
          <p className="text-sm text-faint">{protectedReason}</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              Removes their name, email, profile and sign-in methods, withdraws their listings, turns off their share links and discards drafts. Their orders are kept for
              your records. This can&apos;t be undone.
            </p>
            <Field label='Type "DELETE" to confirm'>
              {({ id }) => <Input id={id} value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} autoComplete="off" />}
            </Field>
            <Button
              variant="ghost"
              size="sm"
              className="border-danger/60 text-danger"
              disabled={confirmDelete !== "DELETE"}
              pending={pending === "delete"}
              onClick={async () => {
                if (await run("delete", () => deleteUserAction(user.id), "Account deleted.")) router.push("/admin/users?status=deleted");
              }}
            >
              Delete account
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Control({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-champagne">{title}</p>
        <p className="text-xs text-faint">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
