import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { IngredientsManager } from "@/components/admin/ingredients-manager";
import { getActor } from "@/server/auth/session";
import { listIngredientsForAdmin } from "@/server/dal/admin-catalog";

export default function AdminIngredientsPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Catalog" title="Ingredients" />
      <Suspense fallback={<p className="text-sm text-muted">Loading ingredients…</p>}>
        <Ingredients />
      </Suspense>
    </>
  );
}

async function Ingredients() {
  return <IngredientsManager ingredients={await listIngredientsForAdmin(await getActor())} />;
}
