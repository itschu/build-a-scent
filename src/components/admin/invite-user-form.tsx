"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { inviteUserAction } from "@/app/(admin)/admin/users/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";

export function InviteUserForm() {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", role: "user" as "user" | "admin" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await inviteUserAction(values);
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast(`Account created. We've emailed ${values.email} a link to set their password.`);
    router.push(`/admin/users/${result.data.id}`);
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-5 border border-line bg-surface p-6" noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      <Field label="Name">
        {({ id }) => <Input id={id} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} autoComplete="off" />}
      </Field>
      <Field label="Email">
        {({ id }) => (
          <Input id={id} type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} autoComplete="off" />
        )}
      </Field>
      <Field label="Role">
        {({ id }) => (
          <Select id={id} value={values.role} onChange={(e) => setValues({ ...values, role: e.target.value as "user" | "admin" })}>
            <option value="user">Customer</option>
            <option value="admin">Admin</option>
          </Select>
        )}
      </Field>
      <Button type="submit" pending={pending}>
        Create and send link
      </Button>
    </form>
  );
}
