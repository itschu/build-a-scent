import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SignUpPageForm } from "./sign-up-page-form";

export const metadata: Metadata = { title: "Create an account · Build a Scent" };

export default function SignUpPage() {
  return (
    <>
      <Eyebrow>Your scent library awaits</Eyebrow>
      <h1 className="mb-6 font-serif text-2xl text-cream">Create an account</h1>
      <Suspense>
        <SignUpPageForm />
      </Suspense>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-gold hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
