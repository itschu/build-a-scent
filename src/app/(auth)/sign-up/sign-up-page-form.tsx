"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { safeRedirectPath } from "@/lib/safe-redirect";

export function SignUpPageForm() {
  const router = useRouter();
  const next = safeRedirectPath(useSearchParams().get("next"));
  return (
    <SignUpForm
      callbackURL={next}
      onSuccess={() => {
        router.replace(next);
        router.refresh();
      }}
    />
  );
}
