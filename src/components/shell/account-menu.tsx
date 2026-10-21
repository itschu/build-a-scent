"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "@/lib/auth-client";

export function AccountMenu() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  if (isPending) return <span className="w-16" aria-hidden />;

  if (!session) {
    return (
      <Link href="/sign-in" className="font-serif text-[0.75rem] uppercase tracking-label text-muted hover:text-gold">
        Sign in
      </Link>
    );
  }

  const isAdmin = (session.user as { role?: string }).role === "admin";
  const initial = (session.user.name || session.user.email).trim().charAt(0).toUpperCase();
  const links = [
    { href: "/account", label: "Account" },
    { href: "/account/orders", label: "Orders" },
    { href: "/account/seller", label: "Seller dashboard" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex size-8 items-center justify-center rounded-full border border-gold-dim font-serif text-sm text-gold hover:border-gold"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-52 border border-line bg-surface py-1 shadow-xl">
          <p className="truncate border-b border-line px-4 py-2 text-xs text-muted">{session.user.email}</p>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-champagne hover:bg-raised hover:text-gold"
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={async () => {
              setOpen(false);
              await signOut();
              router.push("/");
              router.refresh();
            }}
            className="block w-full px-4 py-2 text-left text-sm text-muted hover:bg-raised hover:text-gold"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
