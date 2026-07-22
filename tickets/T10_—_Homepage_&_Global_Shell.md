# T10 — Homepage & Global Shell

## Overview

Build the marketing homepage, global navigation shell, and the dark luxurious design system foundation.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 1 (Landing & Entry), Navigation Structure; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/50911b83-0699-40f0-b18a-89f1d30ebefe — Aesthetic

**Depends on:** T1

## Scope

### In scope

- Global nav bar: Logo · Build a Scent · Shop · Marketplace · My Library (logged-in only) · Account icon; collapses to hamburger on mobile
- Homepage (`/`) — full-screen hero with "Build Your Scent" primary CTA, "Shop Collection" and "Explore Marketplace" secondary CTAs
- Tailwind design tokens: colour palette (deep blacks `#0a0a0a`, gold `#c9a84c`, rich purples), typography (Georgia serif for headings, letter-spacing conventions), spacing
- Global layout wrapper with nav and footer
- Footer/help entry point linking guests to the order lookup flow at `/orders/lookup`
- Cart icon in nav with item count badge wired to `CartStore`

### Out of scope

- Any page content beyond the homepage hero
- Mixer, shop, marketplace pages (other tickets)

## Acceptance Criteria

- Homepage renders with correct dark, luxurious aesthetic matching the wireframes in the Core Flows spec
- Nav shows correct links for guests vs logged-in users
- "Build Your Scent" CTA navigates to `/build`
- Cart icon shows correct item count from `CartStore`
- Footer/help area exposes a guest order lookup link
- Mobile nav collapses to hamburger and expands correctly
- Design tokens are applied consistently across the shell