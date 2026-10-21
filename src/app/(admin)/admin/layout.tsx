import { Suspense } from "react";
import { requireAdmin } from "@/server/auth/session";

// The sidebar shell is added with the global shell (T10).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-16 text-sm text-muted">Loading…</div>}>
      <RequireAdmin>{children}</RequireAdmin>
    </Suspense>
  );
}

async function RequireAdmin({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
