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
   - apply every file in `supabase/migrations/` in filename order through the SQL Editor. The initial schema alone is insufficient; all subsequent migrations are required, including account profiles and invoice signature visibility.
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
npm run e2e:relational    # isolated SQL regression, database-first, 12 RLS checks and sharing/conflict (needs build)
                         # also tests accounting workspace, draft/post replay and firm/year isolation
RELATIONAL_TEST_DB=paperwork_relational_<stamp> npm run e2e:accounting # only the accounting browser workflow
npm run db:check          # safe check of the hosted project in .env.local (creates nothing)
npm run build && npm run e2e            # end-to-end smoke test of the built app
npm run e2e:sharing       # owner / accountant / viewer in three browsers (needs db:start)
npm run db:stop
```

The isolated runner also applies and tests the optional accounting-core, accounting-workflows, accounting-workspace, accounting-documents, accounting-advances, accounting-bank, accounting-payments and accounting-payment-ledger migrations. It then performs both an in-memory SQL recovery rehearsal and a persistent-file recovery rehearsal, followed by browser regressions against the database restored from disk. Restoration compares exact row/sequence fingerprints, schema/indexes, grants, RLS, immutable triggers and replay; a truncated archive must roll back. Finish the build first; it uses Playwright's bundled Chromium by default (`npx playwright install chromium` if needed). Its disposable databases/artifacts are retained for inspection. It does not apply accounting migrations to the existing local or hosted project database. Operational backup of real business data, staging/storage recovery, cluster roles and hosted Auth recovery remain unverified. See [the recovery procedure](ACCOUNTING_RECOVERY.md).

To try sync locally, open Account & backup → Cloud sync and enter `http://127.0.0.1:54321` with the anon key printed by `npx supabase status`.

## Data model

Persistent recovery artifacts can now optionally include explicitly supplied attachment fixtures linked to a firm and an existing accounting document/bank statement. Manifest v2 checks each file and restores it into a separate verified recovery directory; v1 SQL-only copies remain readable. The runner tests attachment integrity, scope and file-write failure, then uses that restored SQL database for browser regressions. With the ninth migration, file descriptors must match the immutable application registry before backup and after restore. Original files are still explicitly supplied; this is not automatic upload or hosted Storage recovery. See [the attachment bundle contract](ACCOUNTING_RECOVERY.md).

Disposable recovery fixtures now also have persistent local artifacts through `npm run db:backup:local -- --database paperwork_relational_<digits>`, `db:backup:verify -- --backup <generated-ID>` and `db:backup:restore -- --backup <generated-ID>`. The isolated runner checks disk persistence, manifest/SHA256 integrity, failed writes, ID collisions and saved recovery reports, then runs browser tests on a database restored from the saved file. Artifacts stay in ignored `.accounting-backups/`; these commands accept only disposable local regression databases. This is not encrypted/scheduled/offsite backup or verified staging/storage/Auth recovery. See [the recovery procedure](ACCOUNTING_RECOVERY.md).

- `paperwork_firms`, `paperwork_members (firm_id, user_id, role)`, `paperwork_invites (firm_id, email, role)`.
- Firm documents use typed rows in `paperwork_invoice_settings`, `paperwork_clients`, `paperwork_invoices`, `paperwork_invoice_items`, `paperwork_yearly_taxes`, `paperwork_tax_paid_months`, `paperwork_kpo_books`, `paperwork_kpo_entries`, `paperwork_kpo_settled_invoices` and `paperwork_audit_entries`.
- Personal documents use `paperwork_resumes` and child tables for contacts, sections, entries, tags, languages and keywords.
- Account selection and revision checks use `paperwork_user_settings`, `paperwork_open_firms`, `paperwork_document_versions` and `paperwork_personal_versions`.

The 24 document/account tables use relational columns and foreign keys; none stores a JSON column. The optional `20261007200000_accounting_core.sql` adds nine relational accounting tables for permissions, years, periods, accounts, partners, journals, lines, request receipts and events. The subsequent `20261007210000_accounting_workflows.sql` adds eight relational tables for agency consent/assignments/audit and revisioned journal drafts/lines/receipts. The subsequent `20261007220000_accounting_workspace.sql` adds scope-checked read RPCs for the workspace, without changing legacy firm membership. JSON is the API and legacy backup transport format. The relational migration converts existing database documents and removes `paperwork_data` and `paperwork_firm_data` in one transaction.

The first accounting workspace is available at `/accounting` when all ten accounting migrations are installed; it supports firm/year selection, chart setup, server drafts, explicit posting and an internal RSD document register. `20261008100000_accounting_documents.sql` adds five relational tables for documents, lines, workflow, immutable source links and request receipts. `20261008120000_accounting_advances.sql` adds three relational tables for advance applications, cancellations and receipts. Applications explicitly transfer balances between manually selected source accounts; cancellation creates a reversal in the same transaction. `20261008140000_accounting_bank.sql` adds six relational tables for bank accounts, statements, transactions, source lines and replay receipts. Excel imports require the documented RSD template, exact text amounts and bank transaction IDs; native bank export adapters remain future work. Preview and balance checks precede explicit import, and retries/overlapping statements do not duplicate transactions. Import does not post a journal or mark invoices paid. `20261008160000_accounting_payments.sql` adds three relational tables for immutable manual bank allocations, cancellations and receipts. Separate confirmed allocations derive bank reconciliation statuses and open/overpaid document amounts, including credits, refunds and advance transfers. Allocation confirmation does not automatically post. The eighth migration, 20261008180000_accounting_payment_ledger.sql, adds three immutable relational tables for bank journals, allocation journals and replay receipts. Separate explicit actions post the full bank transaction through manually selected bank/clearing accounts and each allocation against its document source account. Cancelling a posted allocation requires an open period and creates a reversal atomically; failed reversal rolls back cancellation. Source-account capacity includes linked credits, advance transfers and posted payments. The combined workbench read checks evidence and ledger links in one SQL snapshot; complete partner reporting remains unfinished. Approval, issuance, manually recorded external delivery, source posting and bank reconciliation are separate states. Business validation of advance/payment accounting and complete regulatory invoicing remain unfinished. It is tested in an isolated local database, and never converts existing invoices into journal entries automatically. Apply it to staging first. Ledger, new document, advance, bank and payment tables are not included in the browser's legacy JSON backup/cloud sync; verified server backup and restoration are required before real ledger use. Original Excel files must be retained separately. See [the contracts](ACCOUNTING_CONTRACTS.md) for supported commands and limitations.

Saving uses a transaction and checks the current document revision, so stale browser data cannot overwrite a newer database revision. Issued invoices retain their own party and bank snapshots. Row-level security restricts rows to the signed-in user or their firm membership and role.

After building, set `RELATIONAL_TEST_DB` to the isolated database printed by the relational test and run `node e2e/relational.cjs` for database loading, saving, repeated refresh, firm cleanup and backup restore checks. This test routes document requests to the isolated local database.

The ninth optional accounting migration, `20261008190000_accounting_attachments.sql`, adds an immutable register for externally retained document and bank-statement attachments. The UI hashes a selected file and stores only its name, exact size, SHA256, source revision and archive reference; it does not upload or back up the original. Withdrawal requires a reason and preserves history. Unknown outcomes retain the original command/key. Disposable file recovery fixtures must match registered metadata when the registry exists.

The tenth optional migration, `20261008200000_accounting_reports.sql`, provides complete internal RSD journal, general ledger and trial balance snapshots with opening movements from earlier entries in the selected fiscal year. Reports include reversals, exclude drafts and reject more than 10000 detail lines rather than truncating. Trial-to-account-to-journal drill-down shares one verified snapshot. Excel exports store every cell as text to preserve exact amounts and literal descriptions. Prior-year carryforward, verified opening migration and historical/foreign-currency/regulatory reports remain unfinished.

The eleventh optional migration, `20261008210000_accounting_partner_reports.sql`, adds current RSD partner cards by account, invoice aging with separate customer/supplier and overpayment totals, and controls comparing payment evidence with actual linked journal lines. It includes all recorded postings across fiscal years and shows independent/manual journal balances separately. Advances are excluded from invoice aging. Zero differences still require active source postings and no unposted evidence before being marked reconciled within scope. One three-sheet Excel export preserves exact text amounts and source IDs. This is a current snapshot, not an historical as-of report; reports reject over 10000 partner lines or 5000 issued invoices/advances without truncation. Apply only to isolated validation/staging before business sign-off and original-database activation; the implementation session did not migrate production or the original local business database.

The twelfth optional migration, `20261008220000_accounting_fx.sql`, adds five immutable relational tables for dedicated EUR/USD/CHF/GBP monetary positions, rate history, explicit RSD revaluations, latest-first cancellations, initial-source reversals and replay receipts. It is an initial/revaluation workflow with RSD as functional currency, not foreign invoice/payment support. Rates and source references are manually supplied; the app does not authenticate an NBS list or choose legal/tax rates. Independent postings on the same partner/account block further inference of principal. Preview, exact division/BigInt, permission/revision/period checks and atomic storno are required. Full SQL recovery captures these tables and function/trigger metadata; browser JSON backups do not. Validate supported accounting policy and migration compatibility on isolated staging before activation. The original local business database and production were not migrated during implementation.

The thirteenth optional migration, `20261008230000_accounting_fx_settlements.sql`, adds manual evidence-backed partial/full foreign settlements and realized differences for existing dedicated FX positions. Exact carrying allocation uses integer half-up division; final settlement consumes the complete residual. Later revaluation uses only remaining foreign principal. Payment and revaluation reversals follow one latest-active event sequence, restore both currencies atomically and retain immutable source/rate history. Normalized source-account/bank-ID identity prevents reuse across ledger accounts and positions, including cancellations; already registered bank sources require a future linking adapter. UI previews balanced two/three-line postings and preserves identical pending requests after unknown outcomes. This creates new postings; it does not import currency bank files, match existing posted transactions, track the bank account's own foreign principal, process refunds/fees/overpayments or validate actual bank evidence. Business policy and PAY-02 dependencies remain open; FX-01 is still in progress. Production and the original local business database were not migrated.

The fourteenth optional migration, `20261009000000_accounting_fx_bank.sql`, adds immutable declared EUR/USD/CHF/GBP Excel statements and cancellation-aware links to existing manual FX settlements. Import and linking create no journals. Exact balances and both arrival-order metadata checks reject conflicts atomically; source, currency, amount, direction, booking date and cash account must match. Overlapping statements are rejected. Source receipts, firm permissions and one-to-one links prevent duplicate posting; an unknown response requires the identical pending request/key. Statement arithmetic and unmatched coverage do not establish bank opening balances, all-statement continuity or the RSD ledger balance. Native bank adapters, direct posting from imported rows, split settlements, fees/refunds/overpayments and replacement of cancelled bank IDs remain unfinished. See [the foreign bank contract and reference cases](ACCOUNTING_FX_BANK.md). Main backlog remains 14/32 complete, 18 remaining; FX-01 is in progress. Local isolated migrations/backup validation does not migrate production or the original business database.

The fifteenth optional migration, `20261009010000_accounting_fx_bank_posting.sql`, posts each imported foreign bank row once against an explicitly chosen clearing account. Multiple immutable FX allocations consume its remaining foreign/RSD cover and create settlement/realized-difference journals without reposting cash. Final portions consume the exact RSD residual. Outgoing fees use the same clearing pool; unallocated balances stay visible. Source, allocation, fee and cancellation receipts enforce scoped permissions, revisions, open periods and rollback. Bank reversals require reversed dependencies, and allocation reversals require the latest active FX event. Real bank IDs are preserved through relational provenance; existing manual postings retain their separate linking path. Refunds, incoming net fees, cancelled-source replacement, bank-principal revaluation and all-statement continuity remain unfinished. See [the bank posting contract](ACCOUNTING_FX_BANK_POSTING.md). Main backlog remains 14/32 complete, 18 remaining.
