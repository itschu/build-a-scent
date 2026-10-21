# T7 — Marketplace — Listings & Browse

## Overview

Build the marketplace browse experience and the seller listing flow: listing form with creator markup and featured notes, recipe protection, the duplicate-formula guard, listing detail page, marketplace grid, seller dashboard, and the `ListingIntentHandler` for mixer-originated listings.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flows 5, 9, 12; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Marketplace components, Decisions 8, 9, 11, 12, `marketplace_listings` schema notes

**Depends on:** T3, T4, T5

## Scope

### In scope

- Marketplace page at `/marketplace`: server-rendered grid of `approved` listings; cards show bottle visual, name, creator display name, note profile (scent family per tier + featured notes), buyer price; filters by scent family, price range, featured notes
- Listing detail page at `/marketplace/[id]`: note profile, description, bottle option, creator profile snippet (display name, avatar, bio), buyer price, Add to Cart. Non-approved listings show "This scent is currently unavailable."
- **Recipe protection:** a redacting serializer for marketplace items used by every buyer-facing surface (cards, detail, cart, checkout, confirmation, lookup, emails); the full formula is returned only to the seller and admins
- Listing form at `/marketplace/list?scent=<id>`:
  - pre-filled from the saved scent; requires a verified email
  - creator markup input (≥ `min_creator_markup_kobo`)
  - up to 3 featured notes chosen from the formula
  - bottle option shown read-only
  - live breakdown: blend price, markup, buyer price, estimated earnings at the current `commission_pct`
- Submission: validates ownership, `status = saved`, all ingredients/bottle option active, and no existing listing for the scent; runs the **duplicate-formula guard** (blocked if another seller has a `pending_review` / `approved` / `unavailable` listing with the same `formula_hash`); creates `marketplace_listings` with `status = pending_review`, `submitted_at`
- `ListingIntentHandler` integration: if entry is from the mixer, the scent is saved first, then the form opens
- Seller dashboard at `/account/seller`: listings with status badges (`pending_review` | `approved` | `rejected` | `unavailable` | `withdrawn`), rejection/unavailability reasons; **Edit & Resubmit** (description, markup, featured notes only; formula locked); **Withdraw**; **Relist**; earnings panel showing pending and available balances plus ledger history, with "Payouts coming soon" copy
- DAL authorization tests for `marketplace_listings` and seller ledger reads

### Out of scope

- Admin approval / rejection (T8)
- Automatic `unavailable` transitions on ingredient deactivation (T9)
- Ledger state changes on fulfilment/refund (T9)

## Acceptance Criteria

- The marketplace page shows only `approved` listings and is server-rendered
- Filters work correctly
- No buyer-facing response (HTML or JSON) for a marketplace item contains its non-featured ingredients
- The listing form is pre-filled from the saved scent; the bottle option is read-only; unverified users are prompted to verify
- A markup below the minimum is rejected; the breakdown matches the pricing module
- Submitting creates a `marketplace_listings` row with `status = pending_review`
- Submitting an exact duplicate of another seller's active formula is blocked with the specified message
- The seller dashboard shows correct status badges, reasons, and pending/available earnings
- Resubmit moves `rejected → pending_review` and re-enters the approval queue; Withdraw and Relist work as specified; the formula cannot be changed on a listing
