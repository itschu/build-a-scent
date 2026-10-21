# T4 — Scent Library, Drafts & Sharing

## Overview

Build the My Library page with Saved Scents and Drafts tabs: resume-from-draft, reorder, edit-as-new-version, public share links, listing status badges, and inactive-ingredient view-only enforcement.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 7 (Scent Library), Flow 11 (Share a Scent); spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Library & Saved Scent System components, Decisions 9 & 12, `saved_scents` schema notes

**Depends on:** T2, T3

## Scope

### In scope

- Library page at `/library` with two tabs: **Saved Scents** and **Drafts**
- `SavedScentCard`: bottle visual, scent name, notes summary, date saved, listing badge derived from `marketplace_listings` (Pending Review / Live / Rejected / Unavailable / Withdrawn); actions Reorder, Edit, Share, List for Sale (List for Sale is hidden once a listing exists; the badge links to the seller dashboard instead)
- `DraftCard`: bottle visual, scent name (or "Untitled draft"), partial notes, step reached; **Resume** opens the mixer at `current_step`; **Delete** removes the draft
- `SavedScentAvailabilityGuard`: if any formula ingredient or the bottle option is inactive, it disables Edit, Reorder, Share, and List for Sale and shows an explanatory message, enforced in both the UI and the Server Actions
- **Reorder**: one-click add to `CartStore` using the saved `bottle_option_id` at the current price
- **Edit**: opens the mixer pre-loaded; saving creates a new `saved_scents` row with `parent_scent_id` (original preserved; a listed original stays locked)
- **Share** (`ShareControl`): toggles `is_shared`, generates a random `share_token` (≥128 bits) on first share, and copies `/s/<token>`; turning it off invalidates the link
- **Shared scent page** `/s/[token]` (public, server-rendered): bottle visual, name, creator display name, notes, price for the saved bottle option; CTAs **Order this blend** (add to cart as a custom scent) and **Build your own** (mixer pre-loaded). If the scent has an `approved` listing, the page hides the formula, shows the note profile, and links to the listing. Unshared or invalid tokens show "This scent is no longer shared."
- Empty states for both tabs
- DAL authorization tests for `saved_scents` (owner-only, plus the share-token read rule)

### Out of scope

- Listing form (T7)
- Seller dashboard (T7)

## Acceptance Criteria

- The Saved Scents tab shows all `status = saved` scents for the logged-in user with correct listing badges
- The Drafts tab shows all `status = draft` scents with Resume and Delete
- Resume opens the mixer at the saved step with the correct ingredients and bottle option restored
- Reorder adds the correct item to the cart
- Edit opens the mixer pre-loaded; saving creates a new row with `parent_scent_id`, original unchanged
- A share link works for anyone while sharing is on and stops working when it is turned off
- A shared scent with a live listing never exposes its formula
- Scents with any inactive ingredient or bottle option show a view-only state with all actions disabled, and the server rejects those actions
