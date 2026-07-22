# T11 — Launch Hardening & Operational Readiness

## Overview

Add the final hardening layer required for a strong launch-ready release of Build a Scent. This ticket owns the cross-cutting operational safeguards that sit on top of the core product tickets: webhook idempotency, temporary reservation cleanup, public endpoint abuse protection, email configuration validation, stuck-payment handling, and launch smoke-check readiness.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Payment verification, strict checkout revalidation, low-stock reservation strategy, guest order access, OrdersManager; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Checkout, Payment Processing, Guest Order Lookup, Marketplace purchase flow

**Depends on:** T1–T10

## Scope

### In scope

- **Webhook idempotency and replay safety**
  - Ensure Paystack and Flutterwave webhook handlers are safe against duplicate delivery and replay
  - Prevent duplicate order transitions, duplicate reservation consumption, duplicate seller ledger entries, and duplicate emails
- **Reservation expiry cleanup**
  - Add a cleanup path for expired `inventory_reservations`
  - Ensure expired holds are released predictably if payment never completes
- **Abuse protection on public-sensitive endpoints**
  - Add rate limiting / throttling for:
    - guest order lookup
    - payment status polling
    - any public payment-adjacent verification endpoint
- **Email and configuration hardening**
  - Validate required SMTP/email configuration before launch
  - Verify confirmation, approval, and rejection email flows are configured and testable
- **Stuck-payment operational handling**
  - Define and implement the operational handling path for long-running `verifying_payment` orders
  - Ensure admin can reliably identify, review, and resolve these orders
- **Launch smoke checks**
  - Add a clear smoke-check checklist for the end-to-end critical paths:
    - homepage → build
    - save draft / save scent
    - list for sale
    - standard product purchase
    - marketplace purchase
    - guest order lookup
    - admin moderation
    - fulfillment → seller earnings availability
- **Hardening pass across user-facing critical paths**
  - Verify graceful failure messaging for gateway failures, revalidation failures, manual review states, and inactive saved-scent restrictions

### Out of scope

- CI/CD pipeline design
- production monitoring/alerting stack
- release runbooks beyond launch smoke-check readiness
- payout disbursement
- infrastructure outside the application/codebase

## Acceptance Criteria

- Duplicate or replayed payment webhooks do not create duplicate state transitions, duplicate seller ledger entries, or duplicate emails
- Expired low-stock reservations are released automatically and do not leave inventory stuck
- Guest order lookup and payment-status polling are rate limited
- Email configuration is validated and all critical email flows are testable before launch
- Long-running `verifying_payment` orders are visible and actionable in the admin workflow
- A launch smoke-check checklist exists and covers all critical end-to-end flows
- Critical user-facing failures show clear, non-broken states
- When T1–T11 are complete, the epic is at the agreed **strong launch ready** level