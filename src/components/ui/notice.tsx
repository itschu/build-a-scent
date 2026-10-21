import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "error";

const tones: Record<Tone, string> = {
  info: "border-line text-champagne",
  success: "border-success/40 text-success",
  error: "border-danger/40 text-danger",
};

export function Notice({ tone = "info", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("border px-4 py-3 text-sm", tones[tone], className)}>
      {children}
    </div>
  );
}
