# T2 — Auth & User Profiles

## Overview

Implement authentication flows, session management, the guest auth gate modal, and user profile management.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 3 (Guest Auth Gate); spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Auth & Session components, Admin role enforcement

**Depends on:** T1

## Scope

### In scope

- Sign-up and sign-in pages (`/sign-in`, `/sign-up`) with email/password and social login
- `AuthProvider` wrapping the app, exposing Supabase session via React context
- `AuthModal` — overlay modal triggered by save/listing actions for guests; fires the pending action on successful auth
- Next.js middleware enforcing:
  - `(user)` routes require any authenticated session
  - `(admin)` routes require `role === 'admin'` in the JWT
- Auto-create `profiles` row on first sign-up via Supabase trigger or server action
- Account page (`/account`) — view and edit delivery address, name, email
- In-app notification bell — reads from `notifications` table, marks as read

### Out of scope

- Seller dashboard (T8)
- Admin panel (T9)

## Acceptance Criteria

- Guests can browse the site without an account
- Sign-up creates a `profiles` row with `role = 'user'`
- Logged-in users can access `/library` and `/account`; guests are redirected to sign-in
- `/admin/*` routes redirect non-admins to homepage
- `AuthModal` fires the pending action (save draft, save scent, save-then-list) after successful auth
- Notifications bell shows unread count and marks items read on open