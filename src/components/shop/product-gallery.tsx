"use client";

/* eslint-disable @next/next/no-img-element -- product images may be any admin-provided URL */
import { useState } from "react";
import { DecorativeBottle } from "@/components/scent/decorative-bottle";
import { cn } from "@/lib/cn";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center border border-line bg-coal">
        <DecorativeBottle className="h-2/3" />
      </div>
    );
  }
  return (
    <div>
      <img src={images[index]} alt={name} className="aspect-[4/5] w-full border border-line object-cover" />
      {images.length > 1 && (
        <div className="mt-3 flex gap-3">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
              aria-pressed={i === index}
              className={cn("border", i === index ? "border-gold" : "border-line")}
            >
              <img src={src} alt="" className="size-16 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
