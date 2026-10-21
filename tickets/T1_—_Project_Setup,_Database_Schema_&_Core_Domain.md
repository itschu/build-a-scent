# T1 — Project Setup, Database Schema & Core Domain

## Overview

Bootstrap the Next.js project on Railway, provision PostgreSQL, create the full database schema with Drizzle migrations, build the server-side data access layer (DAL) foundation that replaces Supabase RLS, and implement the shared pricing module. Everything else depends on this.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Core Stack, Decisions 4, 7, 8, 9, Data Model, Authorization Rules, Environment Variables

## Scope

### In scope

- Initialise a Next.js 15+ project with App Router, TypeScript, Tailwind CSS, ESLint, and a test runner (Vitest)
- Install and configure: `drizzle-orm`, `drizzle-kit`, `pg`, `better-auth`, `zod`, `zustand`, `framer-motion`, `@dnd-kit/core`, `nodemailer`, `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- **Railway setup:** app service, PostgreSQL service (daily backups on), and a cron service placeholder. `DATABASE_URL` uses the private network hostname. Document local development (local Postgres via Docker or a Railway dev database).
- **Env validation:** a Zod-validated `env.ts`; the app fails to boot if a required variable is missing
- **Schema & migrations (Drizzle):** all tables from the Tech Plan:
  - Better Auth: `users` (with `role`), `sessions`, `accounts`, `verifications`
  - App: `profiles`, `ingredients`, `bottle_options`, `saved_scents`, `marketplace_listings`, `products`, `product_variants`, `inventory_reservations`, `shipping_zones`, `orders`, `order_items`, `seller_earnings_ledger`, `notifications`, `platform_settings`
  - System: `webhook_events`, `email_outbox`, `rate_limits`
  - All money columns are `bigint` kobo
  - Constraints and indexes: unique `orders.order_number`, unique `products.slug`, unique `marketplace_listings.saved_scent_id`, unique `(webhook_events.gateway, event_id)`, unique `email_outbox.dedupe_key`, unique `(seller_earnings_ledger.order_item_id, entry_type)`, index on `saved_scents.formula_hash`, check constraints on status enums
- **DAL foundation:** `src/server/**` modules marked `server-only`; a `db` client with a connection pool; a pattern for session-aware query functions; the authorization rules table from the Tech Plan captured as test cases (filled in by the tickets that build each domain)
- **Domain modules (pure, unit-tested):**
  - `src/lib/pricing.ts`: custom blend price (volume × concentration × tier shares, integer kobo, rounded up to whole naira) and the marketplace split (buyer price, platform fee, seller earning)
  - `src/lib/formula.ts`: Zod schema for formulas (1–3 per tier for saved scents, partial allowed for drafts), canonical form, and `formula_hash`
  - `src/lib/money.ts`: kobo ↔ naira formatting and USD display conversion
- Route group folder structure: `(public)`, `(auth)`, `(user)`, `(admin)`, `api/`
- **Object storage:** S3-compatible bucket (Railway Storage Bucket, or Cloudflare R2) with public-read prefixes `ingredients/`, `products/`, `bottles/`; a storage helper for presigned uploads; `next.config` image remote patterns
- **Seed script** (`pnpm db:seed`): `platform_settings` defaults (all keys in the Tech Plan, with `is_public` flags), a starter set of bottle options, a Lagos plus "rest of Nigeria" shipping zone, and sample ingredients for development
- **Admin bootstrap:** a `pnpm admin:promote --email <email>` script (runnable via `railway run`) that promotes an existing user to `role = 'admin'`

### Out of scope

- Any UI pages or components
- Auth flows (T2)
- Payment gateway integration (T5)

## Acceptance Criteria

- `pnpm db:migrate` creates all tables with the columns, types, foreign keys, and constraints in the Tech Plan data model on a fresh Railway Postgres
- The app runs locally and on Railway, connected to Postgres over the private network
- Missing required env vars cause a clear boot-time error
- Pricing unit tests cover the Tech Plan worked example (₦23,050), every bottle option format, the 1–3 per tier rule, and the marketplace split (e.g. ₦23,050 blend + ₦5,000 markup at 20% → buyer ₦28,050, seller ₦4,000)
- Formula hashing is order-independent within a tier and ignores the bottle option
- The route group folder structure is in place
- The storage bucket exists and a presigned upload round-trip works
- Seed rows exist for platform settings, bottle options, and shipping zones
- The admin promote script promotes an existing user and is idempotent
