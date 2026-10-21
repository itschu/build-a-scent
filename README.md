# Build a Scent

A fragrance platform with three revenue streams: an interactive scent mixer for custom
orders, a standard shop, and a peer marketplace for community blends. Product and
technical decisions live in [`specs/`](specs); work is broken into [`tickets/`](tickets).

**Stack:** Next.js 16 (App Router) · PostgreSQL on Railway · Drizzle ORM · Better Auth ·
Tailwind CSS · Paystack + Flutterwave · S3-compatible object storage.

## Local development

Requirements: Node 22+, pnpm 10, and Postgres 16 (`docker compose up -d` starts one).

```bash
pnpm install
cp .env.example .env          # then fill in BETTER_AUTH_SECRET and CHECKOUT_CONTEXT_SECRET
pnpm db:migrate               # apply migrations
pnpm db:seed --sample         # settings, bottle options, shipping zones + sample ingredients
pnpm dev
```

Integration variables (Google, Paystack, Flutterwave, SMTP, storage) are optional locally
and required in production; the server refuses to start without them.

### Payments locally

With `PAYMENTS_MODE=fake` (localhost only), checkout sends you to `/dev/fake-gateway`, a test
page that can pay, decline, pay the wrong amount, or pay without sending the webhook (to see
the processing page verify directly). It sends real, signed webhooks to the app. To test
against Paystack or Flutterwave sandboxes, set `PAYMENTS_MODE=live` with test keys and expose
`/api/webhooks/paystack` and `/api/webhooks/flutterwave` to the gateway.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js development server, production build, production server |
| `pnpm test` | Unit tests, plus database tests when `TEST_DATABASE_URL` is set (that database is wiped) |
| `pnpm typecheck` / `lint` | TypeScript and ESLint |
| `pnpm db:generate --name <change>` | Generate a migration after editing `src/server/db/schema` |
| `pnpm db:migrate` | Apply pending migrations (also runs before every Railway deploy) |
| `pnpm db:seed [--sample]` | Idempotent seed; never overwrites existing rows |
| `pnpm admin:promote --email <email>` | Promote an existing account to admin |
| `pnpm db:studio` | Browse the database with Drizzle Studio |

## Project layout

```
src/app/            routes: (public), (auth), (user), (admin), api/
src/lib/            pure, client-safe domain code (pricing, formulas, money, settings registry)
src/server/         server-only code: database, data access layer, storage
drizzle/            generated SQL migrations (committed)
scripts/            migration, seed and admin CLI scripts
tests/              database and server tests
```

All database access goes through `src/server`. The browser never talks to Postgres, and
each data access function enforces the authorization rules in the Tech Plan.

Deployment is described in [`docs/railway.md`](docs/railway.md).
