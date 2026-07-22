# T9 — Admin Panel

## Overview

Build the remaining admin panel sections: ingredient catalog management, order management (including manual payment review queue), analytics dashboard, and platform settings.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Admin Panel components, SettingsPage, AnalyticsDashboard; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/50911b83-0699-40f0-b18a-89f1d30ebefe — Admin Panel scope

**Depends on:** T6, T8

## Scope

### In scope

- `IngredientsManager` at `/admin/ingredients` — CRUD for ingredients; fields: name, note tier, scent family, colour hex, cost value, image upload, active toggle
- `OrdersManager` at `/admin/orders` — all orders (custom, standard, marketplace); status management including marking orders `fulfilled`; manual review queue for `verifying_payment` orders; release marketplace seller earnings from `pending` to `available` and update `profiles.seller_earnings_cached` when fulfillment completes
- `AnalyticsDashboard` at `/admin/analytics` — server-rendered: total revenue, orders by type, top ingredients by selection count, top-selling marketplace scents, seller earnings summary
- `SettingsPage` at `/admin/settings` — edit `platform_settings` rows: commission %, USD exchange rate, `low_stock_reserve_threshold`
- Admin sidebar navigation linking all admin sections

### Out of scope

- Listings queue (T8)
- Products manager (T6)

## Acceptance Criteria

- Admin can create, edit, deactivate, and delete ingredients
- Deactivating an ingredient is reflected in the mixer (ingredient no longer shown) and library (affected scents become view-only)
- Admin can view all orders and update their status
- `verifying_payment` orders appear in a dedicated manual review queue
- Marking an order `fulfilled` releases matching marketplace seller ledger entries from `pending` to `available` and updates `profiles.seller_earnings_cached`
- Analytics dashboard shows correct aggregated data
- Settings page saves changes to `platform_settings` and changes take effect immediately