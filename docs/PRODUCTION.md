# Running Paperwork in production

Paperwork works in two modes:

- **Local only** (default): everything stays in the browser. Nothing to set up.
- **With a database** (Supabase): the database is the source of truth for documents, firms and account selection. Browser documents are ignored; importing a backup requires choosing an existing destination firm and confirming the restore. Refresh and sign-in never create firms.

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
- **AI on your account.** Users connect their own Eden AI API key. To include AI in the price, proxy Eden AI through a server function and meter usage.
- **Bank statements** are read from Excel/CSV exports. PDF statements and direct bank connections are not supported.

## Set up the database

1. Create a project at <https://supabase.com> in an **EU region**.
2. Apply the schema — either:
   - `npx supabase link --project-ref <ref>` then `npx supabase db push`, or
   - apply all four files in `supabase/migrations/` in filename order through the SQL Editor. The initial schema alone is insufficient; the identity and relational migrations are required. The final migration removes the unused legacy trigger functions.
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
python supabase/tests/relational.test.py # isolated migration, RLS, foreign-key and save/restore checks
npm run db:check          # safe check of the hosted project in .env.local (creates nothing)
npm run build && npm run e2e            # end-to-end smoke test of the built app
npm run e2e:sharing       # owner / accountant / viewer in three browsers (needs db:start)
npm run db:stop
```

To try sync locally, open Account & backup → Cloud sync and enter `http://127.0.0.1:54321` with the anon key printed by `npx supabase status`.

## Data model

- `paperwork_firms`, `paperwork_members (firm_id, user_id, role)`, `paperwork_invites (firm_id, email, role)`.
- Firm documents use typed rows in `paperwork_invoice_settings`, `paperwork_clients`, `paperwork_invoices`, `paperwork_invoice_items`, `paperwork_yearly_taxes`, `paperwork_tax_paid_months`, `paperwork_kpo_books`, `paperwork_kpo_entries`, `paperwork_kpo_settled_invoices` and `paperwork_audit_entries`.
- Personal documents use `paperwork_resumes` and child tables for contacts, sections, entries, tags, languages and keywords.
- Account selection and revision checks use `paperwork_user_settings`, `paperwork_open_firms`, `paperwork_document_versions` and `paperwork_personal_versions`.

All 24 application tables use relational columns and foreign keys; none stores a JSON column. JSON is the API and backup transport format. The relational migration converts existing database documents and removes `paperwork_data` and `paperwork_firm_data` in one transaction.

Saving uses a transaction and checks the current document revision, so stale browser data cannot overwrite a newer database revision. Issued invoices retain their own party and bank snapshots. Row-level security restricts rows to the signed-in user or their firm membership and role.

After building, set `RELATIONAL_TEST_DB` to the isolated database printed by the relational test and run `node e2e/relational.cjs` for database loading, saving, repeated refresh, firm cleanup and backup restore checks. This test routes document requests to the isolated local database.
