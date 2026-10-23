"use client";

import { usePublicSettings } from "@/hooks/use-public-settings";

/** Support email and phone from Settings → Storefront, for the footer's Help column. */
export function SupportContact() {
  const settings = usePublicSettings();
  if (!settings?.support_email && !settings?.support_phone) return null;
  const phoneHref = settings.support_phone.replace(/[^\d+]/g, "");
  return (
    <>
      {settings.support_email && (
        <li>
          <a href={`mailto:${settings.support_email}`} className="text-sm text-muted hover:text-gold">
            {settings.support_email}
          </a>
        </li>
      )}
      {settings.support_phone && (
        <li>
          <a href={`tel:${phoneHref}`} className="text-sm text-muted hover:text-gold">
            {settings.support_phone}
          </a>
        </li>
      )}
    </>
  );
}
