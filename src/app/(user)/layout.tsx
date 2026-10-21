import { Suspense } from "react";
import { requireUser } from "@/server/auth/session";

// Every page in this group needs a signed-in user. The check reads the session, so it
// streams behind a Suspense boundary (Cache Components).
export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RequireUser>{children}</RequireUser>
    </Suspense>
  );
}

async function RequireUser({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}

function PageLoading() {
  return <div className="flex flex-1 items-center justify-center p-16 text-sm text-muted">Loading…</div>;
}
