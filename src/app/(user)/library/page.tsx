import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryView } from "@/components/library/library-view";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getActor } from "@/server/auth/session";
import { listLibrary } from "@/server/dal/library";

export const metadata: Metadata = { title: "My Library · Build a Scent" };

export default function LibraryPage({ searchParams }: PageProps<"/library">) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-8">
      <Eyebrow>My library</Eyebrow>
      <h1 className="mb-8 font-serif text-3xl text-cream">Your scents</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading your library…</p>}>
        <Library searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Library({ searchParams }: { searchParams: PageProps<"/library">["searchParams"] }) {
  const [actor, params] = await Promise.all([getActor(), searchParams]);
  const library = await listLibrary(actor);
  return <LibraryView saved={library.saved} drafts={library.drafts} initialTab={params.tab === "drafts" ? "drafts" : "saved"} />;
}
