# T5 — Cart, Checkout & Payments

## Overview

Implement the full cart-to-confirmation flow: client-side cart store, checkout form, Paystack + Flutterwave integration, webhook handlers, payment processing page, order confirmation, and guest order lookup.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flows 4 & 10; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Cart & Checkout System, Payment data flow, Decisions 3–6, 9–11

**Depends on:** T1, T2

## Scope

### In scope

- `CartStore` — Zustand store persisted to localStorage; `addItem`, `removeItem`, `updateQty`, `clearCart`
- `CartDrawer` — slide-in panel from nav; shows items, quantities, NGN totals, USD display toggle
- Cart page at `/cart`
- Checkout page at `/checkout` — delivery form (pre-filled for logged-in users), order summary, payment selector (Paystack / Flutterwave radio)
- `/api/checkout/initiate` Route Handler:
  - Strict revalidation of prices, listing status, and stock
  - Low-stock reservation creation when stock ≤ `low_stock_reserve_threshold`
  - `INSERT` order (`pending_payment`) + order items with `item_snapshot`
  - Gateway transaction initialisation; returns payment URL
- `/api/webhooks/paystack` and `/api/webhooks/flutterwave` — signature verification, order status update (`paid` / `payment_failed`), reservation consume/release, seller ledger credit insert (pending), email trigger
- `/api/orders/status` — polling endpoint; returns current order status
- `PaymentProcessingPage` at `/checkout/processing` — polls status; routes to confirmation on `paid`, failure on `payment_failed`, manual-review message if `verifying_payment` persists
- `OrderConfirmationPage` — animated bottle visual, scent name, notes breakdown, order number, estimated delivery
- `/api/orders/lookup` — server-side endpoint accepting `order_number + email`
- `GuestOrderLookupPage` at `/orders/lookup` with `GuestOrderLookupForm`
- Order confirmation email includes a guest order lookup link
- Nodemailer email on order confirmation

### Out of scope

- Seller earnings availability (T8 — triggered by fulfillment, not payment)
- Admin order management UI (T9)

## Acceptance Criteria

- Cart persists across page navigations for both guests and logged-in users
- Checkout revalidation blocks payment if prices/availability changed and returns user to cart
- Low-stock products get a reservation row before gateway redirect
- Order is created in `pending_payment` before gateway redirect
- Webhook updates order to `paid` or `payment_failed`; reservation is consumed or released
- Payment processing page polls correctly and routes to the right state
- Confirmation page shows animated bottle visual and order details
- Guest can look up order by order number + email
- Order confirmation email is sent via Nodemailer