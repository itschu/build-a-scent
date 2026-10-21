"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { profileUpdateSchema } from "@/lib/validation/profile";
import { getActor } from "@/server/auth/session";
import { updateOwnProfile } from "@/server/dal/profiles";

export type ProfileFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof z.input<typeof profileUpdateSchema>, string>>;
};

const FIELDS = ["fullName", "displayName", "bio", "avatarUrl", "phone", "deliveryAddress", "city", "state"] as const;

export async function updateProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const actor = await getActor();
  if (actor.kind !== "user") return { status: "error", message: "Your session has expired. Sign in again." };

  const input = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: ProfileFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof typeof fieldErrors;
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors };
  }

  await updateOwnProfile(actor, input as z.input<typeof profileUpdateSchema>);
  revalidatePath("/account");
  return { status: "saved", message: "Profile saved." };
}
