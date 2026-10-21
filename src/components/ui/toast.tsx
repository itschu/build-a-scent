"use client";

import Link from "next/link";
import { useEffect } from "react";
import { create } from "zustand";
import { cn } from "@/lib/cn";

type Toast = {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
  action?: { label: string; href: string };
};

type ToastState = { toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; dismiss: (id: number) => void };

let nextId = 1;

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id: nextId++ }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, options: { tone?: Toast["tone"]; action?: Toast["action"] } = {}) {
  useToastStore.getState().push({ message, tone: options.tone ?? "success", action: options.action });
}

function ToastItem({ toast: t }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), 5000);
    return () => clearTimeout(timer);
  }, [t.id, dismiss]);

  return (
    <div
      role={t.tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-center gap-4 border bg-surface px-4 py-3 text-sm shadow-2xl",
        t.tone === "error" ? "border-danger/50 text-danger" : t.tone === "success" ? "border-gold-dim text-champagne" : "border-line text-champagne",
      )}
    >
      <span className="flex-1">{t.message}</span>
      {t.action && (
        <Link href={t.action.href} className="font-serif text-xs uppercase tracking-label text-gold hover:underline" onClick={() => dismiss(t.id)}>
          {t.action.label}
        </Link>
      )}
      <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted hover:text-gold">
        ×
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full max-w-sm">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
