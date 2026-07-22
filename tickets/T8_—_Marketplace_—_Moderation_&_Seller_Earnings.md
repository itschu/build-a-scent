# T8 — Marketplace — Moderation & Seller Earnings

## Overview

Build the admin listing approval flow, seller notification system, and the seller earnings ledger lifecycle (pending → available on fulfillment).

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 6 (Admin Approval); spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — ListingsQueue, seller_earnings_ledger, Decisions 8 & 12

**Depends on:** T7

## Scope

### In scope

- `/api/listings/approve` — sets `status = approved`, creates in-app notification, sends approval email
- `/api/listings/reject` — requires rejection reason, sets `status = rejected`, creates in-app notification, sends rejection email with reason
- Admin `ListingsQueue` at `/admin/listings` — paginated pending listings; Approve / Reject actions; Reject opens inline reason input
- Seller dashboard earnings display reflects `available` balance only

### Out of scope

- Payout disbursement (out of scope for v1 per Epic Brief)

## Acceptance Criteria

- Admin can approve or reject listings from the queue
- Rejection requires a non-empty reason
- Seller receives in-app notification and email on both approve and reject
- Approved listing immediately appears on the marketplace
- Rejected seller can edit and resubmit
- Seller dashboard shows the correct available earnings