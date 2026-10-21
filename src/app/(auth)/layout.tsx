import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="mb-10 font-serif text-sm tracking-display text-gold">
        BUILD A SCENT
      </Link>
      <div className="w-full max-w-md border border-line bg-surface p-8">{children}</div>
    </main>
  );
}
