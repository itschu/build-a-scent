# T10 — Homepage, Global Shell & Cart Store

## Overview

Build the marketing homepage, global navigation shell, admin layout shell, the dark luxurious design system foundation, and the client-side `CartStore` that the mixer, library, shop, and marketplace all depend on.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 1 (Landing & Entry), Navigation Structure; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Decision 3 (Client-side cart), CartStore, AdminLayout; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/50911b83-0699-40f0-b18a-89f1d30ebefe — Aesthetic

**Depends on:** T1, T2

## Scope

### In scope

- Global nav bar: Logo · Build a Scent · Shop · Marketplace · My Library (logged-in only) · Cart icon with count · Notification bell (T2 component, logged-in only) · Account menu / Sign In; collapses to a hamburger on mobile (cart icon stays visible)
- Homepage (`/`): full-screen hero with the "Build Your Scent" primary CTA and "Shop Collection" / "Explore Marketplace" secondary CTAs
- Tailwind design tokens: colour palette (deep blacks `#0a0a0a`, gold `#c9a84c`, rich purples), typography (Georgia serif for headings, letter-spacing conventions), spacing
- Global layout wrapper with nav and footer
- Footer/help entry point linking guests to the order lookup flow at `/orders/lookup`
- **`CartStore`**: Zustand store persisted to localStorage; `addItem`, `removeItem`, `updateQty`, `replaceAll`, `clearCart`; typed item shapes for `custom_scent` (formula + bottle option + name), `marketplace_listing` (listing ID), and `standard_product` (variant ID), each with a last-seen display price; hydration-safe rendering
- Cart icon in nav with item count badge wired to `CartStore` (links to `/cart`; the drawer is added in T5)
- **`AdminLayout`**: `(admin)` layout with `requireAdmin()` and a sidebar (Dashboard, Orders, Products, Ingredients, Bottle Options, Listings (with pending badge slot), Analytics, Settings); placeholder pages for sections built later

### Out of scope

- Any page content beyond the homepage hero and admin shell
- Mixer, shop, marketplace, cart page, and checkout (other tickets)

## Acceptance Criteria

- The homepage renders with the dark, luxurious aesthetic matching the wireframes in the Core Flows spec
- The nav shows correct links for guests vs logged-in users
- The "Build Your Scent" CTA navigates to `/build`
- `CartStore` persists across reloads, and the cart icon shows the correct item count without hydration errors
- The footer/help area exposes a guest order lookup link
- The mobile nav collapses to a hamburger and expands correctly
- The admin layout is reachable only by admins and links to all admin sections
- Design tokens are applied consistently across the shell
