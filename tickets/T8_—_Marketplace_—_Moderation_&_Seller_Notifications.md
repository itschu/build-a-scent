# T8 — Marketplace — Moderation & Seller Notifications

## Overview

Build the admin listing approval flow and seller notifications (in-app + email). Seller earnings display comes from the ledger (pending vs available); the ledger lifecycle on fulfilment and refund is implemented with order management in T9.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 6 (Admin Approval), Flow 12; spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — ListingsQueue, Decisions 8, 9, 13, Decision 18 (Email delivery)

**Depends on:** T7, T10

## Scope

### In scope

- Admin `ListingsQueue` at `/admin/listings` (inside the T10 admin shell): paginated `pending_review` listings with pending count badge in the sidebar. Each card shows:
  - scent name, creator, **full formula**, featured notes, description, submission date
  - price breakdown: blend price, markup, buyer price, current commission estimate
  - **possible duplicate** warning when another listing shares the `formula_hash`
- **Approve** Server Action (`requireAdmin()`): in one transaction, guarded `pending_review → approved`, sets `approved_at`, creates an in-app notification, and queues the approval email ("Your scent [Name] is now live on the marketplace!")
- **Reject** Server Action: requires a non-empty reason; in one transaction, guarded `pending_review → rejected`, stores `rejection_reason`, creates an in-app notification, and queues the rejection email with the reason and a **Resubmit** link to the seller dashboard
- Email templates: listing approved, listing rejected, listing unavailable, listing available again (the last two are triggered from T9)

### Out of scope

- Payout disbursement (out of scope for v1 per Epic Brief)
- Ledger transitions on fulfilment/refund (T9)

## Acceptance Criteria

- Admin can approve or reject listings from the queue; non-admins cannot call the actions
- Rejection requires a non-empty reason
- The seller receives an in-app notification and exactly one email on both approve and reject
- An approved listing immediately appears on the marketplace
- A rejected seller can edit and resubmit, and the listing reappears in the queue
- Possible duplicates are flagged in the queue
