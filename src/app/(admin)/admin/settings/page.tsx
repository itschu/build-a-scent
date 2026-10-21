import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { SettingsForm } from "@/components/admin/settings-form";
import { ShippingZonesEditor } from "@/components/admin/shipping-zones-editor";
import { getActor } from "@/server/auth/session";
import { getSettingsForAdmin, listShippingZonesForAdmin } from "@/server/dal/admin-settings";

export default function AdminSettingsPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Platform" title="Settings" />
      <Suspense fallback={<p className="text-sm text-muted">Loading settings…</p>}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const actor = await getActor();
  const [settings, zones] = await Promise.all([getSettingsForAdmin(actor), listShippingZonesForAdmin(actor)]);
  return (
    <div className="space-y-12">
      <SettingsForm settings={settings} />
      <ShippingZonesEditor zones={zones} />
    </div>
  );
}
