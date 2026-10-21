"use client";

import { useEffect, useState } from "react";
import type { PublicSettings } from "@/lib/settings";

let request: Promise<PublicSettings | null> | null = null;

function load() {
  request ??= fetch("/api/settings/public")
    .then((r) => (r.ok ? (r.json() as Promise<PublicSettings>) : null))
    .catch(() => null);
  return request;
}

/** Public platform settings, fetched once per page load. */
export function usePublicSettings(): PublicSettings | null {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  useEffect(() => {
    let active = true;
    void load().then((s) => active && setSettings(s));
    return () => {
      active = false;
    };
  }, []);
  return settings;
}
