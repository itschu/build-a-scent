import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/server/auth/session";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-16 text-sm text-muted">Loading…</div>}>
      <RequireAdmin>{children}</RequireAdmin>
    </Suspense>
  );
}

// The shell renders only after the role check, so non-admins never see admin navigation.
async function RequireAdmin({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
