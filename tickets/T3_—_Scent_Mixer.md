# T3 — Scent Mixer

## Overview

Build the full interactive scent mixer — the hero feature of the platform. A 4-step drag-and-drop wizard with animated bottle visual, pricing, and save/cart/list actions.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 2 (Scent Mixer Journey); spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Mixer System components, Pricing formula

**Depends on:** T1, T2

## Scope

### In scope

- Mixer page at `/build` — full-screen, dark luxurious aesthetic
- `MixerWizard` — 4-step state machine: Base Notes → Heart Notes → Top Notes → Name & Preview
- `IngredientGrid` + `IngredientCard` — fetches active ingredients from Supabase filtered by `note_tier`; each card shows colour swatch, name, scent family tag
- `BottleDropZone` — accepts 1–3 drag-and-drop ingredients per tier; enforces max 3
- `BottleVisual` — animated SVG/canvas bottle with three colour layers (base, heart, top) using Framer Motion; layers animate in as ingredients are added
- Step transitions with animated slides between steps
- Step 4 — `MixerPreview`: completed bottle, scent name input, bottle option selector (size + format), dynamic price display
- `PriceCalculator` — client-side: `bottle_option.base_price + SUM(ingredient.cost_value)`
- Four action buttons on Step 4:
  - **Add to Cart** → adds to `CartStore`
  - **Save Draft** → auth gate if guest, then saves `saved_scents` row with `status = draft`
  - **Save to Library** → auth gate if guest, then saves with `status = saved`
  - **List for Sale** → auth gate if guest, saves scent first, then routes to listing form (T7)
- `ListingIntentHandler` — orchestrates the save-then-list flow from the mixer

### Out of scope

- Checkout (T5)
- Listing form UI (T7)

## Acceptance Criteria

- Users can drag ingredients into each tier (1–3 per tier); 4th drag is blocked
- Bottle visual fills with correct colour layers as ingredients are added
- Step transitions animate smoothly
- Price updates dynamically as bottle option changes
- Save Draft and Save to Library persist to `saved_scents` with correct status
- Guest users see `AuthModal` on save/list actions; action completes after auth
- List for Sale from mixer saves the scent first, then opens the listing form