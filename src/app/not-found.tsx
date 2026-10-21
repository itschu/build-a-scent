import Link from "next/link";
import { SiteShell } from "@/components/shell/site-shell";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <SiteShell>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <p className="mb-3 font-serif text-[0.7rem] uppercase tracking-display text-gold">404</p>
        <h1 className="mb-4 font-serif text-3xl text-cream">We couldn&apos;t find that page</h1>
        <p className="mb-8 text-sm text-muted">It may have moved, or the link may be out of date.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonClasses()}>
            Go home
          </Link>
          <Link href="/build" className={buttonClasses({ variant: "ghost" })}>
            Build a scent
          </Link>
        </div>
      </main>
    </SiteShell>
  );
}
