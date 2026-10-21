import Link from "next/link";
import { DecorativeBottle } from "@/components/scent/decorative-bottle";
import { buttonClasses } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_40%,rgba(109,59,138,0.35),transparent_55%),radial-gradient(ellipse_at_20%_80%,rgba(201,168,76,0.12),transparent_50%)]"
      />
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="text-center lg:text-left">
          <p className="mb-6 font-serif text-[0.7rem] uppercase tracking-[0.4em] text-gold">
            Craft your signature fragrance
          </p>
          <h1 className="font-serif text-5xl leading-[1.1] text-cream sm:text-6xl lg:text-7xl">
            Your Scent.
            <br />
            Your Story.
          </h1>
          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-muted lg:mx-0">
            Blend rare ingredients into a fragrance that is uniquely yours. Order it, wear it, or sell it to the world.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 lg:items-start">
            <Link href="/build" className={buttonClasses({ size: "lg" })}>
              Build your scent
            </Link>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/shop" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                Shop collection
              </Link>
              <Link href="/marketplace" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                Explore marketplace
              </Link>
            </div>
          </div>
        </div>
        <DecorativeBottle className="mx-auto hidden w-56 drop-shadow-[0_0_60px_rgba(201,168,76,0.15)] lg:block lg:w-72" />
      </div>
    </section>
  );
}
