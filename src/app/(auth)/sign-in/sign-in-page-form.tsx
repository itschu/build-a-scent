"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeRedirectPath } from "@/lib/safe-redirect";

export function SignInPageForm() {
  const router = useRouter();
  const next = safeRedirectPath(useSearchParams().get("next"));
  return (
    <SignInForm
      callbackURL={next}
      onSuccess={() => {
        router.replace(next);
        router.refresh();
      }}
    />
  );
}
