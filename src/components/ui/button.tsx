import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-gold text-ink hover:bg-gold-bright disabled:bg-gold-dim disabled:text-ink/70",
  ghost: "border border-line text-champagne hover:border-gold hover:text-gold disabled:opacity-50",
  danger: "border border-danger/40 text-danger hover:bg-danger/10 disabled:opacity-50",
  link: "text-gold underline-offset-4 hover:underline disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-[0.7rem]",
  md: "px-6 py-3 text-xs",
  lg: "px-10 py-4 text-sm",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  pending?: boolean;
};

export function buttonClasses({ variant = "primary", size = "md" }: { variant?: Variant; size?: Size } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-serif uppercase tracking-label transition-colors disabled:cursor-not-allowed",
    variant !== "link" && sizes[size],
    variants[variant],
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, pending, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(buttonClasses({ variant, size }), className)}
      {...props}
    >
      {pending && <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
});
