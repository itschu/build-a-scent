import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ListingForm } from "@/components/marketplace/listing-form";
import { buttonClasses } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Notice } from "@/components/ui/notice";
import { getActor } from "@/server/auth/session";
import { NotFoundError, ValidationError } from "@/server/dal/actor";
import { getListingDraft, type ListingDraft } from "@/server/dal/marketplace";

export const metadata: Metadata = { title: "List a scent for sale · Build a Scent" };

export default function ListScentPage({ searchParams }: PageProps<"/marketplace/list">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
      <Eyebrow>Marketplace</Eyebrow>
      <h1 className="mb-8 font-serif text-3xl text-cream">List your scent for sale</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading your scent…</p>}>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/marketplace/list">["searchParams"] }) {
  const scentId = (await searchParams).scent;
  if (typeof scentId !== "string") return <Problem message="Choose a saved scent to list from your library." />;
  let draft: ListingDraft;
  try {
    draft = await getListingDraft(await getActor(), scentId);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) return <Problem message={error.message} />;
    throw error;
  }
  return <ListingForm draft={draft} />;
}

function Problem({ message }: { message: string }) {
  return (
    <div className="space-y-6">
      <Notice tone="error">{message}</Notice>
      <div className="flex gap-3">
        <Link href="/library" className={buttonClasses({ variant: "ghost" })}>
          Go to your library
        </Link>
        <Link href="/account/seller" className={buttonClasses({ variant: "ghost" })}>
          Seller dashboard
        </Link>
      </div>
    </div>
  );
}
