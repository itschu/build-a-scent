import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ListingReviewCard } from "@/components/admin/listing-review-card";
import { buttonClasses } from "@/components/ui/button";
import { getActor } from "@/server/auth/session";
import { listPendingListings, PENDING_PAGE_SIZE } from "@/server/dal/moderation";

export default function AdminListingsPage({ searchParams }: PageProps<"/admin/listings">) {
  return (
    <>
      <AdminPageHeader eyebrow="Marketplace moderation" title="Pending Listings" />
      <Suspense fallback={<p className="text-sm text-muted">Loading the queue…</p>}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Queue({ searchParams }: { searchParams: PageProps<"/admin/listings">["searchParams"] }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { items, total } = await listPendingListings(await getActor(), page);
  const pages = Math.max(1, Math.ceil(total / PENDING_PAGE_SIZE));

  if (total === 0) {
    return <p className="border border-dashed border-line p-10 text-center text-sm text-muted">No listings are waiting for review.</p>;
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-faint">
        {total} waiting · oldest first · page {Math.min(page, pages)} of {pages}
      </p>
      {items.map((item) => (
        <ListingReviewCard key={item.id} listing={item} />
      ))}
      {pages > 1 && (
        <nav className="flex gap-3" aria-label="Pages">
          {page > 1 && (
            <Link href={`/admin/listings?page=${page - 1}`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              ← Newer page
            </Link>
          )}
          {page < pages && (
            <Link href={`/admin/listings?page=${page + 1}`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Next page →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
