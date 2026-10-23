"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LineThumb } from "@/components/cart/line-thumb";
import { CurrencyToggle, Price, UsdNote } from "@/components/cart/price";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { formatNaira } from "@/lib/money";
import { CHECKOUT_PAUSED_DEFAULT, minOrderShortfallKobo, shippingFeeKobo } from "@/lib/order-rules";
import { revealField } from "@/lib/reveal-field";
import { applyIssues, subtotalKobo, type CartIssue, type CartLine } from "@/lib/cart/cart";
import { useCartNotices } from "@/lib/cart/notices-store";
import { useCartStore } from "@/lib/cart/store";
import { cn } from "@/lib/cn";
import { deliveryWindow, formatWindow } from "@/lib/delivery-estimate";
import type { PaymentGateway } from "@/lib/domain";
import { NIGERIAN_STATES } from "@/lib/nigeria";
import { deliverySchema, type CheckoutLine } from "@/lib/validation/checkout";

export type CheckoutPrefill = Partial<Record<"fullName" | "email" | "phone" | "address" | "city" | "state", string>>;

type Zone = { id: string; name: string; states: string[]; feeKobo: number; etaMinDays: number; etaMaxDays: number };

const GATEWAYS: Array<{ id: PaymentGateway; label: string; note: string }> = [
  { id: "paystack", label: "Paystack", note: "Card, bank transfer or USSD" },
  { id: "flutterwave", label: "Flutterwave", note: "Card, bank transfer or mobile money" },
];

function toCheckoutLine(line: CartLine): CheckoutLine {
  const base = { key: line.key, quantity: line.quantity, displayPriceKobo: line.displayPriceKobo };
  switch (line.type) {
    case "custom_scent":
      return { ...base, type: "custom_scent", name: line.name, formula: line.formula, bottleOptionId: line.bottleOptionId };
    case "marketplace_listing":
      return { ...base, type: "marketplace_listing", listingId: line.listingId };
    case "standard_product":
      return { ...base, type: "standard_product", variantId: line.variantId };
  }
}

export type CheckoutRules = {
  checkoutEnabled: boolean;
  pausedMessage: string;
  freeShippingThresholdKobo: number;
  minOrderKobo: number;
};

export function CheckoutForm({
  zones,
  prefill,
  leadDays,
  rules,
}: {
  zones: Zone[];
  prefill: CheckoutPrefill;
  leadDays: number;
  rules: CheckoutRules;
}) {
  const router = useRouter();
  const { lines, hydrated, replaceAll } = useCartStore();
  const setNotices = useCartNotices((s) => s.set);
  const [state, setState] = useState(prefill.state ?? "");
  const [gateway, setGateway] = useState<PaymentGateway>("paystack");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!hydrated) return <p className="text-sm text-muted">Loading your cart…</p>;
  if (lines.length === 0) {
    return (
      <div className="border border-dashed border-line px-6 py-16 text-center">
        <p className="mb-6 font-serif text-lg text-champagne">Your cart is empty.</p>
        <Link href="/build" className={buttonClasses()}>
          Build a scent
        </Link>
      </div>
    );
  }

  const zone = zones.find((z) => z.states.includes(state)) ?? null;
  const subtotal = subtotalKobo(lines);
  const eta = zone ? deliveryWindow(leadDays, zone) : null;
  const shipping = zone ? shippingFeeKobo(zone.feeKobo, subtotal, rules.freeShippingThresholdKobo) : 0;
  const belowMinimum = minOrderShortfallKobo(subtotal, rules.minOrderKobo) > 0;
  const blocked = !rules.checkoutEnabled
    ? rules.pausedMessage || CHECKOUT_PAUSED_DEFAULT
    : belowMinimum
      ? `The minimum order is ${formatNaira(rules.minOrderKobo)} before shipping.`
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const parsed = deliverySchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      // The first field with a problem, in form order.
      const first = Array.from(event.currentTarget.elements).find(
        (el): el is HTMLElement => el instanceof HTMLElement && el.getAttribute("name") !== null && el.getAttribute("name")! in next,
      );
      revealField(first);
      return;
    }
    setErrors({});
    if (!zone) {
      setFormError(`We don't deliver to ${parsed.data.state} yet.`);
      return;
    }
    setFormError(null);
    setPending(true);
    try {
      const response = await fetch("/api/checkout/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: lines.map(toCheckoutLine), delivery: parsed.data, gateway }),
      });
      const body = (await response.json()) as { paymentUrl?: string; error?: string; issues?: CartIssue[] };
      if (response.status === 409 && body.issues) {
        // Something changed since the cart was built: update it and send the customer back to review.
        replaceAll(applyIssues(lines, body.issues));
        setNotices(body.issues.map((i) => i.message));
        router.push("/cart");
        return;
      }
      if (!response.ok || !body.paymentUrl) {
        setFormError(body.error ?? "We couldn't start your payment. Please try again.");
        setPending(false);
        return;
      }
      window.location.assign(body.paymentUrl);
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-10">
        <section className="space-y-5">
          <h2 className="font-serif text-[0.7rem] uppercase tracking-display text-gold">Delivery details</h2>
          <Field label="Full name" error={errors.fullName}>
            {({ id }) => <Input id={id} name="fullName" defaultValue={prefill.fullName} autoComplete="name" aria-invalid={!!errors.fullName} />}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Email" error={errors.email}>
              {({ id }) => <Input id={id} name="email" type="email" defaultValue={prefill.email} autoComplete="email" aria-invalid={!!errors.email} />}
            </Field>
            <Field label="Phone" error={errors.phone}>
              {({ id }) => <Input id={id} name="phone" type="tel" defaultValue={prefill.phone} autoComplete="tel" aria-invalid={!!errors.phone} />}
            </Field>
          </div>
          <Field label="Delivery address" error={errors.address}>
            {({ id }) => (
              <Input id={id} name="address" defaultValue={prefill.address} autoComplete="street-address" aria-invalid={!!errors.address} />
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="City" error={errors.city}>
              {({ id }) => <Input id={id} name="city" defaultValue={prefill.city} autoComplete="address-level2" aria-invalid={!!errors.city} />}
            </Field>
            <Field label="State" error={errors.state}>
              {({ id }) => (
                <Select id={id} name="state" value={state} onChange={(e) => setState(e.target.value)} aria-invalid={!!errors.state}>
                  <option value="">Select a state</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {state && !zone && <Notice tone="error">We don&apos;t deliver to {state} yet.</Notice>}
        </section>

        <section>
          <h2 className="mb-4 font-serif text-[0.7rem] uppercase tracking-display text-gold">Payment method</h2>
          <div role="radiogroup" aria-label="Payment method" className="space-y-3">
            {GATEWAYS.map((g) => (
              <label
                key={g.id}
                className={cn(
                  "flex cursor-pointer items-center gap-4 border px-4 py-4",
                  gateway === g.id ? "border-gold" : "border-line hover:border-gold-dim",
                )}
              >
                <input
                  type="radio"
                  name="gateway"
                  value={g.id}
                  checked={gateway === g.id}
                  onChange={() => setGateway(g.id)}
                  className="accent-gold"
                />
                <span>
                  <span className="block font-serif text-sm uppercase tracking-label text-champagne">{g.label}</span>
                  <span className="text-xs text-muted">{g.note}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <aside className="h-fit space-y-5 border border-line bg-coal p-6">
        <h2 className="font-serif text-[0.7rem] uppercase tracking-display text-gold">Order summary</h2>
        <ul className="divide-y divide-line-soft">
          {lines.map((line) => (
            <li key={line.key} className="flex gap-3 py-3">
              <LineThumb
                colors={line.type === "standard_product" ? undefined : line.colors}
                imageUrl={line.type === "standard_product" ? line.imageUrl : null}
                className="h-14 w-9 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-champagne">{line.name}</p>
                <p className="text-xs text-muted">
                  {line.type === "standard_product" ? line.variantLabel : line.bottleLabel} · × {line.quantity}
                </p>
              </div>
              <Price kobo={line.displayPriceKobo * line.quantity} className="text-sm text-gold" />
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd><Price kobo={subtotal} /></dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Shipping{zone && ` · ${zone.name}`}</dt>
            <dd>
              {!zone ? (
                <span className="text-faint">Choose a state</span>
              ) : shipping === 0 && zone.feeKobo > 0 ? (
                <span className="text-gold">Free</span>
              ) : (
                <Price kobo={shipping} />
              )}
            </dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <dt className="font-serif text-xs uppercase tracking-label text-muted">Total</dt>
            <dd><Price kobo={subtotal + shipping} className="font-serif text-2xl text-gold" /></dd>
          </div>
        </dl>
        {eta && <p className="text-xs text-muted">Estimated delivery: {formatWindow(eta.from, eta.to)}</p>}
        <CurrencyToggle />
        <UsdNote />
        {blocked && <Notice tone="error">{blocked}</Notice>}
        {formError && <Notice tone="error">{formError}</Notice>}
        <Button type="submit" size="lg" className="w-full" pending={pending} disabled={!zone || blocked !== null}>
          Pay <Price kobo={subtotal + shipping} />
        </Button>
        <p className="text-center text-xs text-faint">Prices are checked again before payment. You&apos;ll be charged in naira.</p>
      </aside>
    </form>
  );
}
