"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ADMIN_SECTIONS, type AdminBadges } from "./admin-nav";

export function AdminSidebar({ badges = {} }: { badges?: AdminBadges }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto md:flex-col md:gap-0 md:overflow-visible">
      {ADMIN_SECTIONS.map((s) => {
        const badge = badges[s.key];
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={isActive(s.href) ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center justify-between gap-2 whitespace-nowrap px-4 py-3 font-serif text-[0.7rem] uppercase tracking-label md:border-l-2 md:px-5",
              isActive(s.href)
                ? "text-gold md:border-gold md:bg-raised"
                : "text-muted hover:text-champagne md:border-transparent",
            )}
          >
            {s.label}
            {badge ? (
              <span className="rounded-full bg-gold px-1.5 text-[0.6rem] leading-4 tracking-normal text-ink">{badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
