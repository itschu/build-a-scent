import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { AdminBadges } from "./admin-nav";
import { AdminSidebar } from "./admin-sidebar";

export function AdminShell({ children, badges }: { children: ReactNode; badges?: AdminBadges }) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-line bg-coal md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-line px-5 py-5">
          <Link href="/admin" className="font-serif text-sm tracking-display text-gold">
            ADMIN
          </Link>
          <Link href="/" className="text-xs text-muted hover:text-gold md:hidden">
            View store
          </Link>
        </div>
        <div className="py-2 md:py-4">
          <Suspense>
            <AdminSidebar badges={badges} />
          </Suspense>
        </div>
        <div className="hidden space-y-3 border-t border-line px-5 py-5 md:block">
          <Link href="/" className="block text-xs text-muted hover:text-gold">
            ← View store
          </Link>
          <SignOutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10">{children}</main>
    </div>
  );
}

export function AdminPageHeader({ eyebrow, title, actions }: { eyebrow: string; title: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 font-serif text-[0.65rem] uppercase tracking-display text-gold">{eyebrow}</p>
        <h1 className="font-serif text-2xl text-cream">{title}</h1>
      </div>
      {actions}
    </div>
  );
}

export function ComingSoon({ ticket }: { ticket: string }) {
  return (
    <div className="border border-dashed border-line p-10 text-center text-sm text-muted">
      This section is built in {ticket}.
    </div>
  );
}
