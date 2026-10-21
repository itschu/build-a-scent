# T2 — Auth & User Profiles

## Overview

Implement self-hosted authentication with Better Auth on our Postgres database: session management, route protection, the guest auth gate modal, profiles, and in-app notifications.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 3 (Guest Auth Gate); spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — Decision 5, Auth & Session components, Authorization Rules

**Depends on:** T1

## Scope

### In scope

- Better Auth configured with the Drizzle adapter, database sessions (httpOnly cookie), email/password, and Google OAuth
- Email verification and password reset emails (through the T1 email module, with SMTP; the outbox is fully wired in T5)
- Sign-in, sign-up, forgot-password, and reset-password pages
- `profiles` row created in the same flow as user creation (Better Auth `databaseHooks.user.create.after`); `users.role` defaults to `user` and cannot be set from sign-up input
- `AuthProvider` exposing the session to client components
- **Route protection:**
  - Middleware (`proxy.ts` on Next.js 16): optimistic cookie check that redirects `(user)` / `(admin)` routes when there is no session cookie
  - `requireUser()` / `requireAdmin()` server guards used in the `(user)` and `(admin)` layouts and in every mutating Server Action / Route Handler; non-admins on `/admin/*` are redirected to `/`
- `AuthModal`: overlay triggered by save/listing actions for guests; stores the pending action and mixer state in `sessionStorage` so it survives the Google redirect; runs the pending action after successful auth
- Account page (`/account`): edit full name, display name, avatar, short bio, phone, delivery address, city, and state; change email/password
- In-app notifications: `NotificationBell` component (unread count, dropdown, mark as read), refreshed on navigation and every 60s; a `createNotification()` server helper for other tickets
- DAL authorization tests for `profiles`, `users.role`, and `notifications`

### Out of scope

- Seller dashboard (T7)
- Admin panel pages (T6, T8, T9)
- Placing the bell and account menu in the global nav (T10)

## Acceptance Criteria

- Guests can browse the site without an account
- Sign-up (email or Google) creates a `users` row with `role = 'user'` and a matching `profiles` row
- Email verification and password reset work end to end
- Logged-in users can access `/library` and `/account`; guests are redirected to sign-in
- `/admin/*` redirects non-admins to the homepage, and admin Server Actions reject non-admin sessions even when called directly
- Changing a user's role in the database takes effect on their next request (no stale role)
- `AuthModal` runs the pending action (save draft, save scent, save-then-list) after email/password **and** Google sign-in, with the mixer state preserved
- Public profile reads expose only display name, avatar, and bio
- Notification bell shows the unread count and marks items read on open
