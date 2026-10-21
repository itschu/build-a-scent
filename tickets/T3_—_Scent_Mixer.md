# T3 — Scent Mixer

## Overview

Build the full interactive scent mixer, the hero feature of the platform: a 4-step drag-and-drop wizard with an animated bottle visual, volume-aware pricing, save-draft-at-any-step, and cart/save/list actions.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 2 (Scent Mixer Journey), Flow 3; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Mixer System components, Decision 7 (Pricing formula), Decision 12

**Depends on:** T1, T2, T10

## Scope

### In scope

- Mixer page at `/build`: full-screen, dark luxurious aesthetic
- `MixerWizard`: 4-step state machine (Base Notes → Heart Notes → Top Notes → Name & Preview). It can be initialised from:
  - a draft (`?draft=<id>`, opens at `current_step`)
  - a saved scent (`?from=<id>`, Edit)
  - a shared scent (`?share=<token>`)
- `IngredientGrid` + `IngredientCard`: active ingredients for the current tier, fetched server-side; colour swatch, name, scent family tag; click/keyboard selection as an accessible alternative to drag
- `BottleDropZone`: accepts 1–3 ingredients per tier; enforces max 3
- `BottleVisual`: animated SVG bottle with three colour layers (base, heart, top) using Framer Motion; layers animate in as ingredients are added; exported for reuse by the library, marketplace, and confirmation page
- Animated slide transitions between steps
- `SaveDraftButton` in the wizard header on every step once ≥1 ingredient is selected: auth gate if guest, then upserts a `saved_scents` row (`status = draft`, partial formula, `current_step`, nullable name/bottle option)
- Step 4 `MixerPreview`: completed bottle, scent name input, bottle option selector (active options only), dynamic price from `src/lib/pricing.ts` using the public platform settings
- Action buttons on Step 4:
  - **Add to Cart** → adds `{formula, bottle_option_id, name, displayed price}` to `CartStore` (T10)
  - **Save to Library** → auth gate if guest, then saves (`status = saved`, `formula_hash` computed); if the mixer was opened via Edit, it creates a new row with `parent_scent_id` (the original is untouched)
  - **List for Sale** → auth gate if guest, saves the scent first, then routes to the listing form (T7)
- `ListingIntentHandler`: orchestrates the save-then-list flow from the mixer
- Server Actions validate formulas with the shared Zod schema (active ingredients, correct tier, 1–3 per tier for saved scents) and ownership

### Out of scope

- Checkout (T5)
- Listing form UI (T7)

## Acceptance Criteria

- Users can add ingredients to each tier (1–3 per tier) by drag or keyboard; a 4th is blocked
- The bottle visual fills with the correct colour layers as ingredients are added
- Step transitions animate smoothly
- The price matches the server-side pricing module for every bottle option and updates as the bottle option changes
- Save Draft works from any step and Resume returns to that step with selections restored
- Save to Library persists `status = saved` with a `formula_hash`; saving from Edit creates a new row and leaves the original unchanged
- Guest users see `AuthModal` on save/list actions; the action completes after auth, including after a Google redirect
- List for Sale from the mixer saves the scent first, then opens the listing form
- Deactivated ingredients and bottle options are not shown in the mixer
