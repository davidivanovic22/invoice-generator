# Running Paperwork in production

Paperwork works in two modes:

- **Local only** (default): everything stays in the browser. Nothing to set up.
- **With a database** (Supabase): accounts, sync between devices, and firms shared between people with roles. This is what accountants and teams need.

## What is in place

| Area | Status |
| --- | --- |
| Several firms per user, firm overview for accountants | Done |
| Accounts (email + password), sync between devices | Done, tested against a local Supabase |
| Sharing a firm: owner / accountant / viewer, invites by email | Done, covered by `supabase/tests/rls.test.mjs` |
| Row-level security on every table | Done (10 checks) |
| History of changes per firm (who, when, what) | Done |
| Automatic local backups, backup folder, restore | Done |
| Installable app (PWA), offline, phone layout, dark theme | Done |
| Privacy policy and terms (drafts) | Done — have a lawyer review them |
| Issued invoices are cancelled (storno), never deleted | Done |
| Viewers cannot change a shared firm (app and database) | Done, covered by `e2e/sharing.cjs` |
| Bank statement import, yearly report, limit warning | Done |
| CI: type check, unit tests, build, end-to-end smoke test | `.github/workflows/ci.yml` |
| Deploy on every push to `main` | Cloudflare Workers Builds, `wrangler.jsonc` |

## Not built (decide before selling)

- **SEF** (Serbian e-invoices). Required for invoices to Serbian businesses. The app warns and is meant for invoices abroad.
- **Billing** (subscriptions). Use a merchant of record that supports Serbia, or bank transfer.
- **AI on your account.** Users connect their own Claude API key. To include AI in the price, proxy Claude through a server function and meter usage.
- **Conflict handling** is last-writer-wins per firm and data kind (invoices, KPO, history). When someone else's version replaces unsent local changes, the app says so and points to the local backup that holds them; it does not merge.
- **Bank statements** are read from Excel/CSV exports. PDF statements and direct bank connections are not supported.

## Set up the database

1. Create a project at <https://supabase.com> in an **EU region**.
2. Apply the schema — either:
   - `npx supabase link --project-ref <ref>` then `npx supabase db push`, or
   - paste `supabase/migrations/20261005120000_paperwork.sql` into the SQL Editor and run it.
3. Authentication → Providers → Email: keep **Confirm email** on. Set the Site URL to your domain.
4. Give the app the Project URL and the publishable (anon) key — see "Host the app" below. Users then never see the setup form.
5. Turn on Point-in-Time Recovery (or daily backups) for the project.

## Host the app

The app is deployed on **Cloudflare Workers** (static assets), connected to the GitHub repository: every push to `main` runs `npm run build` and then `npx wrangler deploy` on Cloudflare. `wrangler.jsonc` sets the single-page fallback; `public/_headers` sets caching and security headers.

To connect the database, set two **build variables** in Cloudflare (Worker → Settings → Build → Variables and secrets) and redeploy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The committed `.env` maps them to the `REACT_APP_*` names Create React App reads. Locally, put the same two lines in `.env.local`. The publishable key is public by design; row-level security protects the data. Never use the secret / service-role key in the app.

Do not add a `public/_redirects` file: Workers rejects the usual `/* /index.html 200` rule as an infinite loop.

Other static hosts work too (`netlify.toml` and `vercel.json` are included). Requirements for any host:

- HTTPS (needed for the service worker, the backup folder and the password lock).
- Single-page fallback: unknown paths serve `index.html`.
- Do not cache `index.html` and `service-worker.js`; cache `static/` forever.

## Develop and test locally

```bash
npm start                 # the app, local-only mode
npm run db:start          # local Supabase in Docker (first run downloads images)
npm run db:test           # row-level security checks against it
npm run db:check          # safe check of the hosted project in .env.local (creates nothing)
npm run build && npm run e2e            # end-to-end smoke test of the built app
npm run e2e:sharing       # owner / accountant / viewer in three browsers (needs db:start)
npm run db:stop
```

To try sync locally, open Account & backup → Cloud sync and enter `http://127.0.0.1:54321` with the anon key printed by `npx supabase status`.

## Data model

- `paperwork_data (user_id, key)` — personal data (resumes).
- `paperwork_firms`, `paperwork_members (firm_id, user_id, role)`, `paperwork_invites (firm_id, email, role)`.
- `paperwork_firm_data (firm_id, key ∈ invoices | kpo | audit)` — one JSON document per kind, with `updated_at` and `updated_by`.

One document per kind keeps the client simple and works offline. If firms grow to thousands of invoices, or several people edit one firm at once, move invoices and KPO entries to their own rows.
