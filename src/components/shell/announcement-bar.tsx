"use client";

import { usePublicSettings } from "@/hooks/use-public-settings";

/** The admin's site-wide announcement (Settings → Storefront), hidden when empty. */
export function AnnouncementBar() {
  const text = usePublicSettings()?.announcement_text;
  if (!text) return null;
  return (
    <div role="region" aria-label="Announcement" className="bg-gold px-4 py-2 text-center text-xs tracking-wide text-ink">
      {text}
    </div>
  );
}
