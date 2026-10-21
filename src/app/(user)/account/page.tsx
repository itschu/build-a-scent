import type { Metadata } from "next";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Notice } from "@/components/ui/notice";
import { getActor } from "@/server/auth/session";
import { getOwnProfile } from "@/server/dal/profiles";
import { EmailSettings, PasswordSettings, VerifyEmailBanner } from "./account-security";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your account · Build a Scent" };

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
      <div className="mb-10 flex items-end justify-between gap-4">
        <div>
          <Eyebrow>Account</Eyebrow>
          <h1 className="font-serif text-3xl text-cream">Your details</h1>
        </div>
        <SignOutButton />
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading your details…</p>}>
        <AccountDetails searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AccountDetails({ searchParams }: { searchParams: PageProps<"/account">["searchParams"] }) {
  const [actor, params] = await Promise.all([getActor(), searchParams]);
  const profile = await getOwnProfile(actor);
  const justVerified = params.verified === "1" && profile.emailVerified;

  return (
    <div className="space-y-12">
      {justVerified && <Notice tone="success">Your email is verified. Thank you!</Notice>}
      {!profile.emailVerified && <VerifyEmailBanner email={profile.email} />}
      <section>
        <h2 className="mb-6 font-serif text-sm uppercase tracking-label text-gold">Profile & delivery</h2>
        <ProfileForm profile={profile} />
      </section>
      <section>
        <h2 className="mb-6 font-serif text-sm uppercase tracking-label text-gold">Email</h2>
        <EmailSettings currentEmail={profile.email} />
      </section>
      <section>
        <h2 className="mb-6 font-serif text-sm uppercase tracking-label text-gold">Password</h2>
        <PasswordSettings />
      </section>
    </div>
  );
}
