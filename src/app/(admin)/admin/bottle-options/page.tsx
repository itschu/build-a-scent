import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { BottleOptionsManager } from "@/components/admin/bottle-options-manager";
import { getActor } from "@/server/auth/session";
import { listBottleOptionsForAdmin } from "@/server/dal/admin-catalog";

export default function AdminBottleOptionsPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Catalog" title="Bottle Options" />
      <p className="mb-6 max-w-2xl text-sm text-muted">
        Each size and format combination the mixer offers. Concentration is the share of the bottle that is fragrance
        concentrate; it drives the ingredient cost.
      </p>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <Options />
      </Suspense>
    </>
  );
}

async function Options() {
  return <BottleOptionsManager options={await listBottleOptionsForAdmin(await getActor())} />;
}
