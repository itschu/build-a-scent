# T9 — Admin Panel

## Overview

Build the remaining admin panel sections: ingredient catalog and bottle options (with listing availability cascade), order management (manual payment review with gateway re-verify, fulfilment lifecycle, cancellation, refunds, seller ledger transitions), analytics dashboard, and platform settings including shipping zones.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Admin Panel components, Decisions 6, 13, 16, 17, 19; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 13 (Admin Order Handling); spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/50911b83-0699-40f0-b18a-89f1d30ebefe — Admin Panel scope

**Depends on:** T6, T8

## Scope

### In scope

- `IngredientsManager` at `/admin/ingredients`:
  - CRUD for ingredients (name, note tier, scent family, colour hex, price per ml in kobo, image upload, active toggle)
  - hard delete only when the ingredient has never been referenced by a saved scent or order item; otherwise only deactivation is offered
  - **Deactivation cascade:** in one transaction, `approved` listings whose formula contains the ingredient move to `unavailable` with a reason, and their sellers get a notification + email. **Reactivation** moves `unavailable` listings back to `approved` when all of their ingredients and bottle option are active again.
- `BottleOptionsManager` at `/admin/bottle-options`: CRUD for size, volume (ml), format, concentration %, base price (kobo), active toggle; same deactivation cascade
- `OrdersManager` at `/admin/orders`:
  - tabs **Needs Review** (`verifying_payment` or `needs_attention`), **To Fulfil** (`paid` / `in_production` / `shipped`), **All Orders**; filters by status, type, date
  - order detail: full snapshots (including full formulas for fulfilment), delivery address, payment reference, webhook/verify history
  - **Re-verify with gateway** (uses T5 `applyVerifiedPayment()`)
  - guarded transitions `paid → in_production → shipped → fulfilled`, with customer emails at shipped and fulfilled (delivered)
  - **Fulfilment releases earnings:** marking `fulfilled` moves that order's `pending` `sale_credit` entries to `available` and recomputes `profiles.seller_available_kobo` in the same transaction
  - **Cancel** unpaid orders (`pending_payment` / `verifying_payment` / `payment_failed` → `cancelled`); releases reservations
  - **Record Refund** (full refund issued in the gateway dashboard): reason required; optional "return to stock"; in one transaction, sets the order to `refunded`, sets `pending` credits to `void` or inserts a `refund_debit` for `available` credits, recomputes the seller balance, and queues the refund email
  - clear `needs_attention` with a resolution note
- `AnalyticsDashboard` at `/admin/analytics`: server-rendered over orders with status `paid` or later (excluding `refunded`): total revenue, orders by type, top ingredients by selection count (from paid order snapshots), top-selling marketplace scents, seller earnings summary (pending / available / total)
- `SettingsPage` at `/admin/settings`:
  - edit `platform_settings` (commission %, USD exchange rate, min creator markup, tier shares (must sum to 100), production lead days, low-stock threshold, reservation TTL, payment window) with validation
  - manage `shipping_zones` (name, states, fee, ETA range, active); a state may belong to only one active zone

### Out of scope

- Listings queue (T8)
- Products manager (T6)
- Cron-driven automatic re-verification and expiry (T11)

## Acceptance Criteria

- Admin can create, edit, and deactivate ingredients and bottle options; delete is only possible for never-referenced ingredients
- Deactivating an ingredient or bottle option removes it from the mixer, makes affected library scents view-only, moves affected approved listings to `unavailable` (sellers notified), and reactivation restores them
- Admin can view all orders, move them through the fulfilment statuses, and invalid transitions are rejected
- `verifying_payment` and `needs_attention` orders appear in the Needs Review queue, and Re-verify resolves them using the gateway's answer
- Marking an order `fulfilled` releases matching seller ledger entries from `pending` to `available` and updates `profiles.seller_available_kobo`
- Recording a refund voids or debits seller earnings correctly (balance may go negative), optionally restocks, and emails the customer once
- The analytics dashboard shows correct aggregated data and excludes unpaid/refunded orders
- The settings page saves changes; new values take effect on the next request (public settings cache invalidated)
