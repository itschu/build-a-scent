"use client";

import { useEffect, useRef, useState } from "react";
import { clearPendingAction } from "@/lib/pending-action";
import { cn } from "@/lib/cn";
import { SignInForm } from "./sign-in-form";
import { SignUpForm } from "./sign-up-form";
import { useAuthGateStore } from "./auth-gate";

/** The guest auth gate (Core Flows, Flow 3). Mounted once in the root layout. */
export function AuthModal() {
  const { isOpen, returnTo, close } = useAuthGateStore();
  const [tab, setTab] = useState<"sign-up" | "sign-in">("sign-up");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  function dismiss() {
    // The user backed out, so the action they started shouldn't fire on a later sign-in.
    clearPendingAction(window.sessionStorage);
    close();
  }

  // Sign-in/up refreshes the client session, which makes `usePendingAction` run the saved action.
  function onSuccess() {
    close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onMouseDown={dismiss}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto border border-line bg-surface p-8 focus:outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 id="auth-modal-title" className="font-serif text-xl text-cream">
            Save your scent — create a free account or sign in.
          </h2>
          <button onClick={dismiss} aria-label="Close" className="text-xl leading-none text-muted hover:text-gold">
            ×
          </button>
        </div>
        <div role="tablist" className="mb-6 flex border-b border-line">
          {(["sign-up", "sign-in"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 font-serif text-xs uppercase tracking-label",
                tab === t ? "border-gold text-gold" : "border-transparent text-muted hover:text-champagne",
              )}
            >
              {t === "sign-up" ? "Sign up" : "Sign in"}
            </button>
          ))}
        </div>
        {tab === "sign-up" ? (
          <SignUpForm callbackURL={returnTo} onSuccess={onSuccess} />
        ) : (
          <SignInForm callbackURL={returnTo} onSuccess={onSuccess} />
        )}
      </div>
    </div>
  );
}
