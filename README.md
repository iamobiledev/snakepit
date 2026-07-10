# Docloom

**Docloom — Your team's knowledge, organized.**

Docloom is a Vercel-first collaborative knowledge base built with Next.js (App Router), Neon Postgres, Better Auth, Tiptap, and Vercel Blob. Product naming lives in `src/config/brand.ts` so the temporary name is easy to replace later.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js App Router + React + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui |
| Editor | Tiptap |
| Database | Neon Serverless Postgres + Drizzle ORM |
| Auth | Better Auth (email/password, verification, resets, sessions) |
| Email | Resend behind a reusable provider interface |
| Files | Vercel Blob (+ metadata in Neon) |
| Search | Neon Postgres FTS + `pg_trgm` (swappable service) |
| Tests | Vitest + Playwright |
| Hosting | Vercel (Functions, Cron, Blob, Analytics, preview deploys) |

There is no separate traditional backend. Frontend, Server Components, Server Actions, Route Handlers, auth, authorization, DB access, search, public pages, uploads, and invitations all run inside the Next.js app on Vercel Functions.

## Quick start (local)

```bash
pnpm install
cp .env.example .env.local
# Fill DATABASE_URL, DATABASE_URL_UNPOOLED, BETTER_AUTH_SECRET, NEXT_PUBLIC_APP_URL

pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Seed credentials default to `demo@docloom.local` / `DocloomDemo123!`.

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Local development server |
| `pnpm build` / `pnpm start` | Production build & serve |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm test:e2e` | Playwright smoke tests |
| `pnpm check` | lint + typecheck + unit tests |
| `pnpm db:generate` | Generate Drizzle migrations from schema |
| `pnpm db:migrate` | **Intentional** migration runner (not on every deploy) |
| `pnpm db:seed` | Local development seed |
| `pnpm db:studio` | Drizzle Studio |

## Environment variables

See [`.env.example`](./.env.example) for the full list. Required for a working deploy:

| Variable | Scope | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Server | Pooled Neon URL for app queries |
| `DATABASE_URL_UNPOOLED` | Server | Direct Neon URL for migrations |
| `BETTER_AUTH_SECRET` | Server | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Public | Canonical app URL (no trailing slash) |
| `BETTER_AUTH_URL` | Server | Optional; defaults to `NEXT_PUBLIC_APP_URL` |
| `RESEND_API_KEY` / `EMAIL_FROM` | Server | Transactional email (console fallback in local) |
| `BLOB_READ_WRITE_TOKEN` | Server | Vercel Blob store token |
| `CRON_SECRET` | Server | Bearer token for Cron routes |

Typed validation lives in `src/env/server.ts` (server-only) and `src/env/client.ts` (browser-safe). Missing required vars fail with a clear message. Database credentials are never exposed to the browser.

Set `SKIP_ENV_VALIDATION=1` only for offline lint/typecheck.

## Branding

```ts
// src/config/brand.ts
export const brand = {
  name: "Docloom",
  tagline: "Your team's knowledge, organized.",
  // ...
};
```

Import `brand` instead of hardcoding the product name.

---

## Deployment on Vercel

### 1. Create the Vercel project

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com): **Add New… → Project → Import** the repo.
3. Framework preset: **Next.js**. Build command: `pnpm run build` (also set in `vercel.json`).
4. Root directory: repository root.
5. Do **not** enable Docker or a custom persistent server.

`vercel.json` pins Functions to region `iad1` (US East). Change `regions` to match your Neon primary region for lower latency.

### 2. Connect an existing Neon project

1. Prefer the **Neon Vercel Integration** from the Vercel Marketplace / Neon console.
2. Select your existing Neon account and project.
3. Map:
   - **Production** → production Neon branch/database
   - **Preview** → Neon preview branching (isolated DB per PR when supported)
   - **Development** → local `.env.local` (never point local at production)
4. Confirm Vercel injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).

Preview deployments must **not** use the production database. If preview branching is unavailable, create a dedicated preview Neon branch and set preview env vars manually.

### 3. Neon database branches

| Environment | Neon target |
| --- | --- |
| Local | Personal/dev branch or local Neon branch |
| Vercel Preview | Integration-managed preview branch (or dedicated preview DB) |
| Production | Production branch only |

### 4. Create the Vercel Blob store

1. Vercel project → **Storage → Create → Blob**.
2. Connect the store to the project (Production + Preview).
3. `BLOB_READ_WRITE_TOKEN` is injected automatically.

Private workspace files use private Blob access. Public document assets may use public Blob when appropriate. Metadata (URL, pathname, MIME, size, workspace, uploader, document, access, timestamps) is stored in Neon (`files` table).

### 5. Configure Better Auth

1. Generate `BETTER_AUTH_SECRET`.
2. Set `NEXT_PUBLIC_APP_URL` (and optionally `BETTER_AUTH_URL`) to:
   - Production: `https://your-domain.com`
   - Preview: leave as the preview URL or use a wildcard-aware setup; Better Auth `trustedOrigins` uses the configured app URL.
3. Auth routes: `/api/auth/*`.
4. Sessions are stored in Neon (`session`, `account`, `verification`, `user`).

Supported flows: email/password, email verification, password reset, secure session cookies, workspace invitations, accept invitation, sign out (current device), sign out all devices (`POST /api/auth/revoke-sessions`).

### 6. Configure email delivery

1. Create a [Resend](https://resend.com) API key and verified domain.
2. Set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `Docloom <noreply@your-domain.com>`).
3. Without these, the console email provider logs messages (local-friendly).

The provider interface is in `src/lib/email/` — swap Resend without changing call sites.

### 7. Environment variables checklist

In Vercel → **Settings → Environment Variables**, set values for **Production**, **Preview**, and **Development** as appropriate:

- `DATABASE_URL` / `DATABASE_URL_UNPOOLED` (from Neon integration)
- `BETTER_AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL` (production domain for Production; preview URL pattern for Preview)
- `RESEND_API_KEY`, `EMAIL_FROM`
- `BLOB_READ_WRITE_TOKEN` (from Blob store)
- `CRON_SECRET`

### 8. Run migrations (intentionally)

Migrations are **not** run automatically on every Vercel deployment.

```bash
# Local / CI with credentials
pnpm db:migrate
```

Use `DATABASE_URL_UNPOOLED` for DDL. Apply the same migration files to:

1. Development branch
2. Preview branch (or let Neon branching inherit schema, then migrate if needed)
3. Production branch — run once per release from a trusted machine or a one-off CI job

SQL lives in `drizzle/`. Generate new migrations with `pnpm db:generate` after schema changes.

### 9. Seed development data

```bash
pnpm db:seed
```

Refuses to run in production unless `SEED_ALLOW_PRODUCTION=true`.

### 10. Deploy

- **Preview**: open a pull request — Vercel creates a preview deployment URL automatically.
- **Production**: merge to the production branch (usually `main`). Attach a custom domain under Vercel → Domains.

### 11. Post-deploy health check

```bash
curl https://your-deployment.vercel.app/api/health
```

Expect `{ "ok": true, "service": "docloom", ... }` without secrets.

### 12. Playwright smoke tests

```bash
# Against a running local server after `pnpm build && pnpm start`
pnpm test:e2e

# Against a deployed preview or production URL
PLAYWRIGHT_BASE_URL=https://your-preview.vercel.app pnpm test:e2e
```

### Rolling back a deployment

1. Vercel → Project → **Deployments**.
2. Open the last known-good production deployment → **Promote to Production**.
3. If a migration was applied and is incompatible, restore the Neon branch (point-in-time or previous branch) **before** or **as part of** the rollback — schema roll-forward is preferred when possible.

### Custom domain

1. Vercel → **Domains** → add `app.your-domain.com` (or apex).
2. Update DNS as instructed.
3. Set Production `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` to `https://your-domain.com`.
4. Redeploy so auth cookies and email links use the production domain.

---

## Architecture notes

### Authorization

Workspace IDs, roles, and permissions are resolved on the server from Neon membership rows. Client-supplied roles are never trusted (`src/lib/permissions.ts`).

### Search

`src/lib/search` implements a `SearchService` interface. The Neon implementation uses:

- `pg_trgm` + GIN for fuzzy titles
- `tsvector` / FTS for body content
- Weighted ranking (exact title → prefix → fuzzy → terms → body → recency)
- Permission filtering **inside** SQL via `workspace_members`

Replace with Typesense/Meilisearch later without changing the UI.

### Public documents

- Route: `/p/[slug]` (stable public slug, not internal IDs)
- Unauthenticated, read-only
- Open Graph + SEO metadata
- 404 when not public / missing
- `revalidatePath` on publish/unpublish

### Cron (Vercel Cron)

| Path | Schedule | Purpose |
| --- | --- | --- |
| `/api/cron/expire-invitations` | daily 03:00 UTC | Expire pending invitations |
| `/api/cron/prune-versions` | daily 03:30 UTC | Prune old document versions |

Both require `Authorization: Bearer $CRON_SECRET`.

### Observability

- Production-safe JSON logging in `src/lib/logger.ts` (redacts secrets)
- `@vercel/analytics` is enabled in the root layout
- Optional: connect Vercel log drains / OpenTelemetry later without changing app architecture

### What this architecture avoids

Long-running processes, sticky sessions, always-on WebSockets, local filesystem persistence, Docker in production, continuous background workers, and auto-destructive migrations on deploy.

---

## Troubleshooting

### Database connection failures

1. Confirm `DATABASE_URL` is the **pooled** (`-pooler`) connection for the app.
2. Confirm `DATABASE_URL_UNPOOLED` is the **direct** host for migrations.
3. Check Neon console: branch awake, IP allow list (Neon serverless typically allows Vercel egress).
4. Ensure preview env vars do not point at production.
5. Align `vercel.json` `regions` with Neon primary region.

### Missing environment variables

1. Compare Vercel env settings to `.env.example`.
2. Ensure variables are enabled for the correct environment (Production / Preview / Development).
3. Redeploy after changing env vars.
4. Check `/api/health` for presence flags (not values).

### Auth not working on production domain

1. `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` must match the HTTPS production domain.
2. Rotate/check `BETTER_AUTH_SECRET`.
3. Confirm email verification links use the same domain.
4. Clear cookies and retry.

### Blob upload failures

1. Confirm Blob store is linked and `BLOB_READ_WRITE_TOKEN` is set.
2. Check MIME allow list and 10 MB size limit in `src/lib/blob/upload.ts`.
3. Confirm the user is a workspace member with edit permission.

---

## Project layout

```
src/
  config/brand.ts          # Product naming
  env/                     # Zod env validation
  db/                      # Drizzle schema + Neon client
  lib/                     # Auth, email, search, blob, permissions, documents
  components/              # UI + editor
  app/                     # App Router pages, actions, API routes
drizzle/                   # SQL migrations
scripts/migrate.ts         # Production-safe migrate
scripts/seed.ts            # Dev seed
e2e/                       # Playwright smoke tests
vercel.json                # Regions, build, crons
```

## License

Private / unpublished unless otherwise specified.
