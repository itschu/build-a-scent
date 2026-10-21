"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { AccountMenu } from "./account-menu";
import { CartIcon } from "./cart-icon";

const PRIMARY_LINKS = [
  { href: "/build", label: "Build a Scent" },
  { href: "/shop", label: "Shop" },
  { href: "/marketplace", label: "Marketplace" },
];

/**
 * The interactive header reads the pathname, which on dynamic routes is request data, so it
 * renders behind Suspense with a static frame (same layout, no active state) as fallback.
 */
export function SiteHeader() {
  return (
    <Suspense fallback={<StaticHeader />}>
      <InteractiveHeader />
    </Suspense>
  );
}

function StaticHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" className="font-serif text-sm tracking-display text-gold">
          BUILD A SCENT
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {PRIMARY_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="font-serif text-[0.75rem] uppercase tracking-label text-muted">
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="w-24" aria-hidden />
      </div>
    </header>
  );
}

function InteractiveHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = session ? [...PRIMARY_LINKS, { href: "/library", label: "My Library" }] : PRIMARY_LINKS;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" className="font-serif text-sm tracking-display text-gold" onClick={() => setMenuOpen(false)}>
          BUILD A SCENT
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "font-serif text-[0.75rem] uppercase tracking-label transition-colors",
                isActive(l.href) ? "text-gold" : "text-muted hover:text-gold",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <CartIcon />
          <NotificationBell />
          <div className="hidden md:block">
            <AccountMenu />
          </div>
          <button
            className="p-2 text-muted hover:text-gold md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-line bg-ink px-4 pb-6 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "block border-b border-line-soft py-4 font-serif text-sm uppercase tracking-label",
                isActive(l.href) ? "text-gold" : "text-champagne",
              )}
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-4" onClick={() => setMenuOpen(false)}>
            {session ? (
              <div className="flex flex-col gap-3 text-sm">
                <Link href="/account" className="text-champagne">Account</Link>
                <Link href="/account/orders" className="text-champagne">Orders</Link>
                <Link href="/account/seller" className="text-champagne">Seller dashboard</Link>
              </div>
            ) : (
              <Link href="/sign-in" className="font-serif text-sm uppercase tracking-label text-gold">
                Sign in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
