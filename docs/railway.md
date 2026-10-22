# Deploying on Railway

The project runs as Railway services in one project, connected over Railway's private
network.

| Service | Source | Purpose |
| --- | --- | --- |
| **app** | this repo (`railway.json`) | Next.js server. Runs `pnpm db:migrate` before each deploy, then `pnpm start`; health check `/api/health` |
| **Postgres** | Railway Postgres template | Primary database. Turn on daily backups in the service's Backups tab |
| **jobs** | this repo, cron schedule `*/5 * * * *` | Background jobs (`pnpm jobs:run`): release expired stock holds, expire abandoned orders, re-verify stuck payments, retry emails, prune rate limits |
| **Volume** | Railway volume attached to the app, mounted at `/data` | Uploaded images, served by the app at `/uploads/...` |

## First deploy

1. Create a Railway project, add the **Postgres** service, and connect this GitHub repo as the **app** service.
2. On the app service, set the variables from `.env.example`:
   - `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` (the private-network URL)
   - `APP_URL` and `BETTER_AUTH_URL` → the app's public URL
   - `BETTER_AUTH_SECRET` and `CHECKOUT_CONTEXT_SECRET` → `openssl rand -base64 32` each
   - Google, Paystack, Flutterwave, Resend (`RESEND_API_KEY`, `EMAIL_FROM`) credentials, and `UPLOADS_DIR=/data`. The server refuses to start in production if any are missing.
3. Deploy. Migrations run automatically before the new version starts.
4. Seed once: from a machine with the Railway CLI, run
   `railway run --service app -- sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL pnpm db:seed'`
   (`DATABASE_PUBLIC_URL` comes from the Postgres service; the private URL only resolves inside Railway).
5. Sign up on the site with the owner's email, then promote that account the same way:
   `... pnpm admin:promote --email owner@example.com`.

## Image storage

Admin uploads are written to a Railway volume attached to the app service
(`railway volume add --mount-path /data`) and served by the app at `/uploads/<key>`.
Set `UPLOADS_DIR=/data` on the app service. A volume belongs to one service, so the app
must run as a single replica.

## Schema changes

Edit `src/server/db/schema`, run `pnpm db:generate --name <change>`, review the SQL in
`drizzle/`, and commit it. The next deploy applies it.

## Background jobs service

1. In the Railway project, **New → GitHub Repo** and pick this repo again; name the service `jobs`.
2. Settings → Deploy: set the **Start command** to `pnpm jobs:run` and the **Cron schedule** to
   `*/5 * * * *`. Remove the health check and pre-deploy command for this service (the app
   service already runs migrations).
3. Variables: share the app service's variables (at minimum `DATABASE_URL`, `APP_URL`,
   `NODE_ENV=production`, gateway secrets, `RESEND_API_KEY` and `EMAIL_FROM`), e.g. `${{app.PAYSTACK_SECRET_KEY}}`.

Each run executes every job once, prints a one-line JSON summary, and exits non-zero if any
job failed. Jobs claim rows with `FOR UPDATE SKIP LOCKED`, so overlapping runs are safe.

## Payment webhooks

| Gateway | Webhook URL | Secret |
| --- | --- | --- |
| Paystack | `https://<domain>/api/webhooks/paystack` | Signed with `PAYSTACK_SECRET_KEY` (no separate secret) |
| Flutterwave | `https://<domain>/api/webhooks/flutterwave` | Set a **Secret hash** in the dashboard and the same value as `FLUTTERWAVE_WEBHOOK_HASH` |

Use the live keys and URLs in production and the test keys on staging. Webhooks only mark
events as received; every payment is confirmed by calling the gateway's verify API.

## Backups and restore test

1. Postgres service → **Backups**: enable daily backups (and keep at least 7 days).
2. Once before launch, test a restore: in a scratch Railway project (or a new Postgres service),
   restore the latest backup, point a local checkout at its public URL and run
   `DATABASE_URL=<scratch url> pnpm db:migrate` (should report nothing to apply), then spot-check
   `select count(*) from orders;` against production.
3. Record the date in the restore log in `docs/launch-smoke-checks.md`, then delete the scratch service.

## Health check

`railway.json` sets `healthcheckPath: /api/health`. It returns `200 {"status":"ok"}` only when
the database is reachable, so a deploy that cannot reach Postgres never takes traffic.
