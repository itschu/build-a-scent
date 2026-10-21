"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { LibraryScent } from "@/server/dal/library";
import { DraftCard } from "./draft-card";
import { SavedScentCard } from "./saved-scent-card";

type Tab = "saved" | "drafts";

export function LibraryView({ saved, drafts, initialTab }: { saved: LibraryScent[]; drafts: LibraryScent[]; initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  function select(next: Tab) {
    setTab(next);
    window.history.replaceState(null, "", next === "drafts" ? "/library?tab=drafts" : "/library");
  }

  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: "saved", label: "Saved scents", count: saved.length },
    { key: "drafts", label: "Drafts", count: drafts.length },
  ];

  return (
    <>
      <div role="tablist" aria-label="Library" className="mb-8 flex border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => select(t.key)}
            className={cn(
              "-mb-px border-b-2 px-5 py-3 font-serif text-xs uppercase tracking-label",
              tab === t.key ? "border-gold text-gold" : "border-transparent text-muted hover:text-champagne",
            )}
          >
            {t.label} <span className="ml-1 text-faint">{t.count}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "saved" ? (
          saved.length === 0 ? (
            <EmptyState message="You haven't saved any scents yet. Build your first one." cta="Build a scent" />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {saved.map((scent) => (
                <SavedScentCard key={scent.id} scent={scent} />
              ))}
            </div>
          )
        ) : drafts.length === 0 ? (
          <EmptyState message="No drafts in progress." cta="Start a new blend" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {drafts.map((scent) => (
              <DraftCard key={scent.id} scent={scent} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function EmptyState({ message, cta }: { message: string; cta: string }) {
  return (
    <div className="border border-dashed border-line px-6 py-16 text-center">
      <p className="mb-6 font-serif text-lg text-champagne">{message}</p>
      <Link href="/build" className={buttonClasses()}>
        {cta}
      </Link>
    </div>
  );
}
