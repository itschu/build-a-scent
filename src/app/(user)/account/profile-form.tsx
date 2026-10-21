"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { NIGERIAN_STATES } from "@/lib/nigeria";
import type { OwnProfile } from "@/server/dal/profiles";
import { updateProfileAction, type ProfileFormState } from "./actions";

export function ProfileForm({ profile }: { profile: OwnProfile }) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(updateProfileAction, {
    status: "idle",
  });
  const err = (field: keyof NonNullable<ProfileFormState["fieldErrors"]>) => state.fieldErrors?.[field];

  return (
    <form action={formAction} className="space-y-5">
      {state.message && <Notice tone={state.status === "saved" ? "success" : "error"}>{state.message}</Notice>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" error={err("fullName")}>
          {({ id }) => <Input id={id} name="fullName" defaultValue={profile.fullName ?? ""} autoComplete="name" maxLength={120} />}
        </Field>
        <Field label="Display name" hint="Shown publicly on your marketplace listings" error={err("displayName")}>
          {({ id, describedBy }) => (
            <Input id={id} name="displayName" defaultValue={profile.displayName ?? ""} maxLength={40} aria-describedby={describedBy} />
          )}
        </Field>
      </div>
      <Field label="Short bio" hint="Up to 280 characters, shown on your listings" error={err("bio")}>
        {({ id, describedBy }) => (
          <Textarea id={id} name="bio" defaultValue={profile.bio ?? ""} maxLength={280} aria-describedby={describedBy} />
        )}
      </Field>
      <Field label="Avatar image URL" hint="An https:// link to a square image" error={err("avatarUrl")}>
        {({ id, describedBy }) => (
          <Input id={id} name="avatarUrl" type="url" defaultValue={profile.avatarUrl ?? ""} aria-describedby={describedBy} />
        )}
      </Field>
      <Field label="Phone" error={err("phone")}>
        {({ id }) => <Input id={id} name="phone" type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" />}
      </Field>
      <Field label="Delivery address" error={err("deliveryAddress")}>
        {({ id }) => (
          <Input id={id} name="deliveryAddress" defaultValue={profile.deliveryAddress ?? ""} autoComplete="street-address" maxLength={200} />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="City" error={err("city")}>
          {({ id }) => <Input id={id} name="city" defaultValue={profile.city ?? ""} autoComplete="address-level2" maxLength={80} />}
        </Field>
        <Field label="State" error={err("state")}>
          {({ id }) => (
            <Select id={id} name="state" defaultValue={profile.state ?? ""}>
              <option value="">Select a state</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Button type="submit" pending={pending}>
        Save details
      </Button>
    </form>
  );
}
