import { Suspense } from "react";
import { SiteShell } from "@/components/shell/site-shell";
import { requireUser } from "@/server/auth/session";

// Every page in this group needs a signed-in user. The check reads the session, so it
// streams behind a Suspense boundary (Cache Components) while the shell renders at once.
export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell>
      <Suspense fallback={<PageLoading />}>
        <RequireUser>{children}</RequireUser>
      </Suspense>
    </SiteShell>
  );
}

async function RequireUser({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}

function PageLoading() {
  return <div className="flex flex-1 items-center justify-center p-16 text-sm text-muted">Loading…</div>;
}
