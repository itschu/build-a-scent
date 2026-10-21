# T5 — Cart, Checkout, Shipping & Payments

## Overview

Implement the full cart-to-confirmation flow: cart page and drawer, checkout with shipping zones, Paystack + Flutterwave integration with webhooks **and** server-side verification, forward-only order transitions, the email outbox, the payment processing page, order confirmation, and guest order lookup.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flows 4 & 10; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Cart & Checkout System, Payment data flow, Decisions 3, 6, 8–10, 14–19

**Depends on:** T1, T2, T10

## Scope

### In scope

- `CartDrawer` (opened from the T10 nav cart icon) and cart page at `/cart`: items, quantities, NGN totals, USD display toggle; marketplace items show the note profile only
- Checkout page at `/checkout`:
  - delivery form (name, email, phone, address, city, Nigerian state; pre-filled for logged-in users)
  - shipping fee and ETA from the matching active `shipping_zones` row; unsupported states block checkout
  - order summary (subtotal, shipping, total)
  - payment selector (Paystack / Flutterwave)
- `/api/checkout/initiate` Route Handler:
  - **Strict revalidation** of every line: custom scents (active ingredients in the correct tier, 1–3 per tier, active bottle option, recalculated price); marketplace listings (`approved`, all formula ingredients active, recalculated buyer price); standard products (active product and variant, sufficient stock); shipping zone and fee. Any change returns the updated cart state with per-item reasons and creates no order.
  - Low-stock reservation (`expires_at = now + reservation_ttl_minutes`) when available stock ≤ `low_stock_reserve_threshold`
  - In one transaction: `INSERT` the order (`pending_payment`, non-sequential `order_number`, `subtotal_kobo`, `shipping_fee_kobo`, `total_kobo`, ETA dates) and order items with the full `item_snapshot` (including the marketplace price split at the current `commission_pct`)
  - Gateway transaction initialisation in kobo/NGN; returns the payment URL
  - Sets the HMAC-signed, httpOnly checkout context cookie (`{order_id, exp}`, 2 hours)
- Gateway return handler: guarded `pending_payment → verifying_payment` only
- `src/server/payments/verify.ts`: server-to-server verification for Paystack and Flutterwave; checks status, amount (= `total_kobo`), and currency (NGN)
- `/api/webhooks/paystack` and `/api/webhooks/flutterwave`:
  - signature verification
  - `webhook_events` insert-or-skip
  - amount/currency check (a mismatch sets `needs_attention` and does not mark the order paid)
  - in one transaction: guarded update to `paid` / `payment_failed` (an `expired` order that gets a verified success becomes `paid` with `needs_attention` if its stock is gone); reservations consumed/released, or stock deducted with a guarded update; a `pending` `sale_credit` ledger row per marketplace item; `email_outbox` row
- Shared `applyVerifiedPayment()` used by webhooks, the processing-page verify, and (later) the admin re-verify and cron, so all paths behave identically
- `/api/orders/status`: polling endpoint authorised by checkout context or session; may trigger one throttled server-side verify per order every 30s once the order has been unconfirmed for ~20s
- `PaymentProcessingPage` at `/checkout/processing`: polls; routes to confirmation on `paid` (and clears the cart); shows failure with **Try again** on `payment_failed`; shows the manual-review message (with the order number) after ~90s in `verifying_payment`
- `OrderConfirmationPage` (Server Component, authorised by checkout context or session): animated bottle, scent name, notes (redacted for marketplace items), order number, estimated delivery window
- **Email outbox:** `src/server/email` (Nodemailer SMTP) with `queueEmail(dedupeKey, template, payload)` → insert-or-skip + immediate send attempt; order confirmation email including the guest **Look Up Order** link. No public email route.
- `/api/orders/lookup` + `GuestOrderLookupPage` at `/orders/lookup` with `GuestOrderLookupForm`: generic not-found message; confirmation-safe, redacted view; status and ETA shown
- Logged-in order history at `/account/orders`
- DAL authorization tests for `orders` / `order_items` (owner, checkout context, lookup, redaction)

### Out of scope

- Seller earnings availability on fulfilment (T9)
- Admin order management UI, re-verify button, refunds (T9)
- Cron jobs for expiry, re-verification, and email retries, plus rate limiting (T11)

## Acceptance Criteria

- The cart persists across page navigations for both guests and logged-in users
- Checkout revalidation blocks payment and returns the user to the cart with reasons when prices, ingredients, listings, stock, or shipping changed
- The shipping fee and ETA are correct per zone; unsupported states cannot check out
- Low-stock variants get a reservation row before the gateway redirect
- The order is created in `pending_payment` before the gateway redirect, with totals in kobo
- A webhook arriving **before** the redirect return leaves the order `paid` (no regression to `verifying_payment`)
- A webhook or verify call with a mismatched amount does not mark the order paid and flags it
- The webhook updates the order to `paid` or `payment_failed`; reservations are consumed or released
- The payment processing page polls correctly and routes to the right state, including server-side verify when the webhook is late
- The confirmation page shows the animated bottle visual and order details; marketplace items never show the full formula
- A guest can look up an order by order number + email; a wrong combination shows a generic message
- The order confirmation email is sent exactly once via the outbox
