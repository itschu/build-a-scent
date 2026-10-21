import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SignInPageForm } from "./sign-in-page-form";

export const metadata: Metadata = { title: "Sign in · Build a Scent" };

export default function SignInPage() {
  return (
    <>
      <Eyebrow>Welcome back</Eyebrow>
      <h1 className="mb-6 font-serif text-2xl text-cream">Sign in</h1>
      <Suspense>
        <SignInPageForm />
      </Suspense>
      <p className="mt-6 text-sm text-muted">
        New here?{" "}
        <Link href="/sign-up" className="text-gold hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
