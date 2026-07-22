# T4 — Scent Library & Drafts

## Overview

Build the My Library page with Saved Scents and Drafts tabs, including resume-from-draft, reorder, edit, and inactive-ingredient view-only enforcement.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 7 (Scent Library); spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Library & Saved Scent System components

**Depends on:** T2, T3

## Scope

### In scope

- Library page at `/library` — two tabs: **Saved Scents** and **Drafts**
- `SavedScentCard` — bottle visual, scent name, notes summary, date saved; actions: Reorder, Edit, List for Sale
- `DraftCard` — bottle visual, scent name, partial notes; **Resume** action restores draft state in the mixer
- `SavedScentAvailabilityGuard` — checks if any ingredient in `ingredient_ids` is `is_active = false`; if so, disables Edit, Reorder, and List for Sale and shows an explanatory message
- **Reorder** — one-click add to `CartStore` using the saved `bottle_option_id`
- **Edit** — opens mixer pre-loaded with saved blend; saving creates a new `saved_scents` row (original preserved)
- **List for Sale** — routes to listing form (T7)
- Empty state for both tabs

### Out of scope

- Listing form (T7)
- Seller dashboard (T8)

## Acceptance Criteria

- Saved Scents tab shows all `status = saved | listed` scents for the logged-in user
- Drafts tab shows all `status = draft` scents with Resume action
- Resume opens the mixer with the correct ingredient and bottle option state restored
- Reorder adds the correct item to cart
- Edit opens mixer pre-loaded; saving creates a new row, original unchanged
- Scents with any inactive ingredient show view-only state with all actions disabled