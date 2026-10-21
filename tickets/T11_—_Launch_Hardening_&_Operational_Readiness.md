# T11 — Launch Hardening & Operational Readiness

## Overview

Add the final hardening layer required for a strong launch-ready release of Build a Scent on Railway. This ticket owns the cross-cutting operational safeguards that sit on top of the core product tickets: webhook idempotency verification, background jobs (reservation expiry, stale-order expiry, stuck-payment re-verification, email retries), public endpoint rate limiting, email/config validation, stuck-payment handling, and launch smoke checks.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Decisions 6, 10, 15, 16, 18, 19, `webhook_events` / `email_outbox` / `rate_limits` schema notes, OrdersManager; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Checkout, Payment Processing, Guest Order Lookup, Marketplace purchase flow, Flow 13

**Depends on:** T1–T10

## Scope

### In scope

- **Webhook idempotency and replay safety**
  - Integration tests that deliver the same Paystack and Flutterwave event multiple times and concurrently, and out of order with the redirect return
  - Confirm no duplicate order transitions, reservation consumption, stock deduction, seller ledger entries (unique keys), or emails (outbox dedupe)
- **Background jobs** (Railway cron service running `pnpm jobs:run` every 5 minutes; each job is idempotent and safe to run concurrently using `FOR UPDATE SKIP LOCKED`):
  - release expired `inventory_reservations`
  - move `pending_payment` orders older than `payment_window_minutes` with no gateway result to `expired` (a late verified success is still honoured per Decision 16)
  - re-verify orders stuck in `verifying_payment` for more than 10 minutes, for up to 24 hours, via `applyVerifiedPayment()`
  - retry `failed` / stale `pending` `email_outbox` rows with backoff (max attempts, then surfaced to admin)
  - prune old `rate_limits` rows
- **Rate limiting** (Postgres-backed fixed window in `rate_limits`, keyed by IP and, where relevant, order number/email) for:
  - guest order lookup
  - payment status polling (including its server-side verify trigger)
  - checkout initiation
  - sign-in, sign-up, and password reset (in addition to Better Auth's built-in limits)
- **Email and configuration hardening**
  - Boot-time env validation covers SMTP, gateway, auth, storage, and checkout context secrets
  - An admin-only "Send test email" action; all templates (order confirmation, payment under review, shipped, delivered, refund, listing approved/rejected/unavailable/available again, verification, password reset) render and send in a staging environment
- **Stuck-payment operational handling**
  - The Needs Review queue shows age, gateway, reference, verify attempts, and last gateway response
  - Admin can reliably identify, re-verify, cancel, or resolve these orders; the customer receives a "payment under review" email when an order enters manual review and the normal confirmation email once resolved
- **Operational readiness on Railway**
  - Railway Postgres daily backups confirmed enabled and a restore tested once on a scratch database
  - Health check endpoint (`/api/health`, checks DB connectivity) configured in Railway
  - Gateway webhook URLs and secrets configured for production; webhooks reachable over HTTPS
- **Launch smoke checks**
  - A smoke-check checklist (`docs/launch-smoke-checks.md`) covering the end-to-end critical paths:
    - homepage → build
    - save draft (any step) / resume / save scent / share link
    - list for sale (incl. duplicate block and recipe redaction)
    - custom scent purchase
    - standard product purchase (incl. low-stock reservation)
    - marketplace purchase
    - late webhook → processing page server-side verify
    - guest order lookup
    - admin moderation
    - ingredient deactivation → listing unavailable → reactivation
    - fulfilment → seller earnings available
    - refund → earnings reversed
- **Hardening pass across user-facing critical paths**
  - Verify graceful failure messaging for gateway failures, revalidation failures, unsupported shipping states, manual review states, unavailable listings, and inactive saved-scent restrictions

### Out of scope

- CI/CD pipeline design
- Production monitoring/alerting stack
- Release runbooks beyond launch smoke-check readiness
- Payout disbursement
- Infrastructure outside the application/codebase and its Railway services

## Acceptance Criteria

- Duplicate, concurrent, or replayed payment webhooks do not create duplicate state transitions, duplicate seller ledger entries, or duplicate emails
- Expired low-stock reservations are released automatically and do not leave inventory stuck
- Abandoned `pending_payment` orders expire; stuck `verifying_payment` orders are re-verified automatically
- Guest order lookup, payment-status polling, checkout initiation, and auth endpoints are rate limited
- Email configuration is validated and all critical email flows are testable before launch; failed emails are retried
- Long-running `verifying_payment` and `needs_attention` orders are visible and actionable in the admin workflow
- Backups are enabled and a restore has been tested; the health check passes on Railway
- A launch smoke-check checklist exists and covers all critical end-to-end flows
- Critical user-facing failures show clear, non-broken states
- When T1–T11 are complete, the epic is at the agreed **strong launch ready** level
