# T7 — Marketplace — Listings & Browse

## Overview

Build the marketplace browse experience and the seller listing flow: listing form, listing detail page, marketplace grid, and the `ListingIntentHandler` for mixer-originated listings.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flows 5, 9; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Marketplace components, Decisions 7 & 12

**Depends on:** T3, T4, T5

## Scope

### In scope

- Marketplace page at `/marketplace` — server-rendered grid of approved listings; filters by scent family, price range, top ingredients
- Listing detail page at `/marketplace/[id]` — full notes breakdown, creator profile snippet, price, Add to Cart
- Listing form at `/marketplace/list` — pre-filled from saved scent; seller price input with live commission estimate; bottle option shown read-only; Submit for Review
- `ListingIntentHandler` — if entry is from mixer, saves scent first then opens listing form
- Seller dashboard at `/account/seller` — listings with status badges (`pending_review` | `approved` | `rejected`), rejection reason, Resubmit button, cached earnings balance

### Out of scope

- Admin approval (T8)
- Earnings ledger updates (T8)

## Acceptance Criteria

- Marketplace page shows only `approved` listings; server-rendered
- Filters work correctly
- Listing detail page shows full notes and Add to Cart
- Listing form is pre-filled from the saved scent; bottle option is read-only
- Commission estimate shows current platform rate
- Submitting creates a `marketplace_listings` row with `status = pending_review`
- Seller dashboard shows correct status badges and rejection reasons
- Resubmit re-enters the approval queue