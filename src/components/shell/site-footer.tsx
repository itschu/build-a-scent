import { cacheLife } from "next/cache";
import Link from "next/link";
import { SupportContact } from "./support-contact";

const COLUMNS = [
  {
    title: "Create",
    links: [
      { href: "/build", label: "Build a Scent" },
      { href: "/library", label: "My Library" },
      { href: "/account/seller", label: "Sell your blends" },
    ],
  },
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "Collection" },
      { href: "/marketplace", label: "Marketplace" },
      { href: "/cart", label: "Cart" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/orders/lookup", label: "Look up an order" },
      { href: "/account/orders", label: "Your orders" },
      { href: "/account", label: "Account" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-coal">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        <div>
          <p className="font-serif text-sm tracking-display text-gold">BUILD A SCENT</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            Blend rare ingredients into a fragrance that is uniquely yours. Handmade and shipped across Nigeria.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="mb-4 font-serif text-[0.7rem] uppercase tracking-label text-gold">{col.title}</p>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted hover:text-gold">
                    {l.label}
                  </Link>
                </li>
              ))}
              {col.title === "Help" && <SupportContact />}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line-soft py-6 text-center text-xs text-faint">
        © <CopyrightYear /> Build a Scent
      </div>
    </footer>
  );
}

/**
 * Cached so the year can be computed without making every page dynamic. Only the year is
 * cached: client components (like the support contact) inside a cached component make the
 * dev server reload in a loop.
 */
async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}
