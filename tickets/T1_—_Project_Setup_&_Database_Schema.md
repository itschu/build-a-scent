# T1 — Project Setup & Database Schema

## Overview

Bootstrap the Next.js project, configure Supabase, and create the full database schema with RLS policies. Everything else depends on this.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Core Stack, Data Model, RLS Policy Summary

## Scope

### In scope

- Initialise Next.js 14+ project with App Router, Tailwind CSS, and TypeScript
- Install and configure: `@supabase/supabase-js`, `@supabase/ssr`, `zustand`, `framer-motion`, `@dnd-kit/core`, `nodemailer`
- Create all Supabase tables: `profiles`, `ingredients`, `bottle_options`, `saved_scents`, `marketplace_listings`, `products`, `product_variants`, `inventory_reservations`, `orders`, `order_items`, `seller_earnings_ledger`, `notifications`, `platform_settings`
- Apply all RLS policies as specified in the Tech Plan
- Set up route group folder structure: `(public)`, `(auth)`, `(user)`, `(admin)`, `api/`
- Configure Supabase Auth with email/password and social login providers
- Seed initial `platform_settings` rows: `default_commission_pct`, `usd_exchange_rate`, `low_stock_reserve_threshold`
- Add a one-time seed / migration step that creates or promotes a known admin account for first-time admin access
- Configure Supabase Storage buckets for ingredient images, product images, and bottle visuals

### Out of scope

- Any UI pages or components
- Payment gateway configuration

## Acceptance Criteria

- All tables exist in Supabase with correct columns, types, and foreign keys matching the Tech Plan data model
- RLS policies are active and enforce the access rules in the Tech Plan
- Next.js project runs locally with Supabase connected
- Route group folder structure is in place
- Storage buckets are created with appropriate public/private access settings
- `platform_settings` seed rows exist
- A one-time admin bootstrap step exists and can create or promote the initial admin account