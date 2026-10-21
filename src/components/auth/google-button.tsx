"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function GoogleButton({ callbackURL, onError }: { callbackURL: string; onError: (message: string) => void }) {
  const [pending, setPending] = useState(false);

  async function signInWithGoogle() {
    setPending(true);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL });
    // On success the browser navigates to Google, so only failures return here.
    if (error) {
      setPending(false);
      onError(
        error.code === "PROVIDER_NOT_FOUND"
          ? "Google sign-in isn't available right now. Use your email instead."
          : (error.message ?? "Google sign-in failed. Please try again."),
      );
    }
  }

  return (
    <Button variant="ghost" className="w-full" pending={pending} onClick={signInWithGoogle}>
      Continue with Google
    </Button>
  );
}
