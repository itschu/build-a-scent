"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { markNotificationsReadAction } from "@/app/actions/notifications";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

type Item = { id: string; message: string; link: string | null; isRead: boolean; createdAt: string };

const REFRESH_MS = 60_000;

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Unread count + dropdown; refreshes on navigation and every minute. Hidden for guests. */
export function NotificationBell() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { unread: number; items: Item[] };
    setItems(data.items);
    setUnread(data.unread);
  }, []);

  useEffect(() => {
    if (!session) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with the server
    void refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [session, pathname, refresh]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  if (!session) return null;

  async function toggle() {
    const next = !open;
    setOpen(next);
    const unreadIds = items.filter((i) => !i.isRead).map((i) => i.id);
    if (next && unreadIds.length > 0) {
      setUnread(0);
      setItems((current) => current.map((i) => ({ ...i, isRead: true })));
      await markNotificationsReadAction(unreadIds);
    }
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative p-2 text-muted hover:text-gold"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-gold px-1 text-center text-[0.6rem] leading-4 text-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] border border-line bg-surface shadow-xl">
          <p className="border-b border-line px-4 py-3 font-serif text-[0.7rem] uppercase tracking-label text-gold">
            Notifications
          </p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((item) => {
                const body = (
                  <>
                    <p className="text-sm text-champagne">{item.message}</p>
                    <p className="mt-1 text-xs text-faint">{timeAgo(item.createdAt)}</p>
                  </>
                );
                return (
                  <li key={item.id} className={cn("border-b border-line-soft", !item.isRead && "bg-plum/40")}>
                    {item.link ? (
                      <Link href={item.link} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-raised">
                        {body}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
