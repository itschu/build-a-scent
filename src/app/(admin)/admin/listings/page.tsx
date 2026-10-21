import { AdminPageHeader, ComingSoon } from "@/components/admin/admin-shell";

export default function AdminPendingListingsPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Marketplace moderation" title="Pending Listings" />
      <ComingSoon ticket="T8" />
    </>
  );
}
