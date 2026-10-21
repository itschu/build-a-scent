# Deploying on Railway

The project runs as Railway services in one project, connected over Railway's private
network.

| Service | Source | Purpose |
| --- | --- | --- |
| **app** | this repo (`railway.json`) | Next.js server. Runs `pnpm db:migrate` before each deploy, then `pnpm start`; health check `/api/health` |
| **Postgres** | Railway Postgres template | Primary database. Turn on daily backups in the service's Backups tab |
| **jobs** | this repo, cron schedule `*/5 * * * *` | Background jobs (`pnpm jobs:run`), added with launch hardening (T11) |
| **Bucket** | Railway Storage Bucket (or Cloudflare R2) | Uploaded images, publicly readable |

## First deploy

1. Create a Railway project, add the **Postgres** service, and connect this GitHub repo as the **app** service.
2. On the app service, set the variables from `.env.example`:
   - `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` (the private-network URL)
   - `APP_URL` and `BETTER_AUTH_URL` → the app's public URL
   - `BETTER_AUTH_SECRET` and `CHECKOUT_CONTEXT_SECRET` → `openssl rand -base64 32` each
   - Google, Paystack, Flutterwave, SMTP and `S3_*` credentials. The server refuses to start in production if any are missing.
3. Deploy. Migrations run automatically before the new version starts.
4. Seed once: from a machine with the Railway CLI, run
   `railway run --service app -- sh -c 'DATABASE_URL=$DATABASE_PUBLIC_URL pnpm db:seed'`
   (`DATABASE_PUBLIC_URL` comes from the Postgres service; the private URL only resolves inside Railway).
5. Sign up on the site with the owner's email, then promote that account the same way:
   `... pnpm admin:promote --email owner@example.com`.

## Object storage

Create a bucket with public read access and set `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `S3_PUBLIC_BASE_URL` (the base URL images are
served from). Allow `PUT` from the app's origin in the bucket's CORS settings so admins can
upload images directly from the browser.

## Schema changes

Edit `src/server/db/schema`, run `pnpm db:generate --name <change>`, review the SQL in
`drizzle/`, and commit it. The next deploy applies it.
