import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/server/auth/session";
import { countPendingListings } from "@/server/dal/moderation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-16 text-sm text-muted">Loading…</div>}>
      <RequireAdmin>{children}</RequireAdmin>
    </Suspense>
  );
}

// The shell renders only after the role check, so non-admins never see admin navigation.
async function RequireAdmin({ children }: { children: React.ReactNode }) {
  const actor = await requireAdmin();
  const pendingListings = await countPendingListings(actor);
  return <AdminShell badges={{ listings: pendingListings }}>{children}</AdminShell>;
}
