# Paperwork: invoices & resumes

## Accounting system roadmap

Bank postings and allocation reversals now show exact debit/credit previews before confirmation. The isolated regression runner also rehearses full SQL restoration and runs the app against the restored copy; [recovery coverage and remaining work](docs/ACCOUNTING_RECOVERY.md) distinguish this local check from staging/storage recovery.

The planned expansion targets accounting agencies managing multiple Serbian businesses, including limited liability companies. See the [accounting system plan](docs/ACCOUNTING_SYSTEM_PLAN.md) for scope, architecture, migration safeguards and release criteria, and the [implementation backlog](docs/ACCOUNTING_BACKLOG.md) for dependencies. The opt-in `/accounting` workspace supports firm/year selection, chart setup, server drafts, explicit posting and an internal RSD document register with approval, issuance, source-linked posting and partial advance applications with reversal. It also imports RSD bank statements from the supported Excel template, with preview, balance checks and duplicate protection. Saved bank transactions support manual partial payment allocations, linked refunds, cancellation and open/overpaid document amounts. Separate explicit actions post the full bank transaction through a clearing account and each allocation against the document's source account; cancelling a posted allocation creates its reversal atomically. It needs all ten accounting migrations and verified staging setup; business validation of advance/payment accounting, server backup/restore, full reports and regulatory modules remain unfinished. This is not yet a complete system for independent production accounting.

Invoices, the KPO book, earnings and limits for Serbian flat-rate businesses, plus ATS-ready resumes. It runs in the browser with no account and no server; your data stays on your device. Connect a database when you want sync, or to work together with an accountant.

## Features

### Made to be effortless
- **Serbian and English interface** (switch any time; Serbian plurals done right).
- **Home page** with the three things you do most, "invoice again" in one click, a setup checklist and recent documents.
- **First-run welcome** that sets up your business in one screen.
- **Click anything in the live preview** to jump to its field. **Undo/redo** with Ctrl+Z / Ctrl+Y.
- **Ctrl+K** to create, navigate or find any invoice or resume.
- Deleting is instant with **Undo** in the notification; optional fields stay hidden until you need them.

### Invoices
- **Quick invoice:** repeat a client's last invoice in one click, describe it in one sentence ("Acme, 40 h at 25 €, due in 15 days") and let AI fill it in, or use a five-field form, with **Create & download PDF**.
- Downloading a draft's PDF marks it as sent.
- **Type it once.** Business details, bank account, logo, signature and defaults live in the business profile, so every new invoice arrives filled in.
- **Client address book.** Clients are saved automatically; start typing a name to reuse one, and repeat the last invoice's items in one click.
- **Correct numbers.** Amounts are computed in integer minor units: every line is rounded, the subtotal is the sum of the printed lines, and VAT is applied once. Sequential numbering (`2026-001`) warns about duplicates.
- **Five templates** (Modern, Classic, Minimal, Bold, Seasonal with monthly illustrations), with accent colours, in English, Serbian or both.
- **Status tracking:** draft, sent, paid and overdue, with outstanding and paid totals.

### KPO book, earnings and taxes (Serbia)
- **KPO book:** add paid invoices with one click, import your existing book from Excel or CSV, export to styled Excel, CSV or PDF.
- **Overview:** income per month, the monthly flat-rate tax, net earnings, and progress toward the 6M RSD yearly and 8M RSD rolling limits, in EUR or RSD at the NBS middle rate.
- **Recurring invoices**, payment reminders, ready-made emails (Gmail or mail app), and a yearly Excel for the accountant.
- Notes for invoicing abroad in one click ("not registered for VAT"); a warning for clients in Serbia, whose invoices must go through SEF.

### Firms, accountants and sync
- **Several firms** in one app, each with its own invoices, KPO book and taxes; an "All firms" page shows income, limits and warnings per firm.
- **Optional database (Supabase):** sign in, sync between devices, and share a firm with an **owner / accountant / viewer** role by inviting an email address. Row-level security keeps every firm private to its members.
- **History of changes** per firm: who changed what, and when.
- Password lock, automatic daily backups (30 days), backup folder on disk, restore.
- Installable (PWA), works offline, phone layout, dark theme.

See [docs/PRODUCTION.md](docs/PRODUCTION.md) for running it for customers.

### Resumes
- **Six templates** (Modern, Classic/ATS, Minimal, Executive, Creative, Compact) with real multi-page pagination.
- Ordered sections you can rename, hide and reorder; new resumes start from a well-written example or empty.
- **ATS check:** an instant, offline score from 0 to 100 with prioritised findings. Paste a job ad to measure keyword coverage.
- **Eden AI (optional, bring your own key):**
  - *Improve with AI to 95+* rewrites the headline, summary and bullet points, then re-scores until the target is reached.
  - *Fix step by step* lets you review every change with an editable before/after view.
  - *Import existing CV* reads a PDF, Word or text resume and rebuilds it in the editor.
  - It never invents facts: unknown numbers become `[X%]` placeholders for you to fill in, and skills from the job ad must be confirmed by you.

### Export
Invoices, the KPO book, the year report and cover letters download straight to a PDF file (**Download PDF**), with a **Preview** first if you want one. The pages are rendered as A4 images (about 190 dpi), so the file looks exactly like the preview; long invoices continue on further pages, cut between rows.

Resumes still go through the browser's print engine (**Download PDF**, then choose **Save as PDF**), because ATS parsers need the real, selectable text that produces.

## Using Eden AI

1. Create an API key at [app.edenai.run](https://app.edenai.run/settings/api-keys).
2. Click **Connect AI** in the header and paste it.

The key is stored only in your browser's local storage and sent only to `api.edenai.run`. Usage is billed to your Eden AI account. The app uses Eden AI V3 with schema-validated structured outputs; PDF CV import uses `ocr/resume_parser/affinda`, then `openai/gpt-latest` for faithful formatting.

## Your data

Without a configured database, documents are saved in `localStorage` (`studio.invoices.v2`, `studio.kpo.v1`, `studio.resumes.v2`; further firms use `<key>@<firmId>`). A snapshot of all of it is kept in IndexedDB every day. Use **Backup** on the list pages to export JSON, and **Import** / **Restore backup** to bring it back; imports merge and never overwrite existing documents. Data from older versions of the app is migrated automatically, and the old keys are kept as a backup. If saved data is ever unreadable, a copy is stored under a `.backup.<date>` key before anything else happens.

With Supabase configured, the database is the source of truth. Business documents are loaded into memory before their stores render; old browser documents are not uploaded or migrated automatically. Choose existing firms with **Open a cloud firm**. Firm selection is saved to your account, so another browser can open the same firm. Refreshing never creates or imports additional firms. New firms require an explicit action and a unique PIB.

Apply SQL migrations in order, including `20261007120000_firm_identity.sql`, `20261007140000_relational_documents.sql` and `20261007150000_remove_legacy_triggers.sql`, before running this application version. PIB protection blocks legacy clients from inserting new firms directly on refresh. The relational migration converts existing database documents, preserves company/document IDs and memberships, and removes the two old JSON document tables in one transaction. The final cleanup removes their unused trigger functions. Invalid foreign keys or unrecognized personal datasets abort conversion and retain the old data. Never run the migration with a client/browser key; use the Supabase SQL Editor or your linked CLI.

Documents use typed relational columns: business profile/defaults, clients, invoices, invoice items, yearly taxes/paid months, KPO books/entries/settled invoices, audit entries, resumes/contacts/sections/entries/tags/languages/keywords, account selection and document revisions. Every child has a foreign key and firm/user scope. Invoice party/bank snapshots preserve issued documents when profiles change. JSON is only the API/backup transport format; no application table stores a JSON column. Saving or restoring documents runs in a database transaction; routine saves check the database revision to prevent stale overwrites.

To import an old single-firm backup, sign in, explicitly open the destination firm, then use **Account & backup → Restore from file**. Its invoices, clients, profile, KPO and audit belong to that selected existing firm; CVs belong to the signed-in account. The confirmation identifies the destination and document counts, and the previous database documents are backed up first. No firms are created by restore. **Keep only this firm** backs up database documents and permanently deletes your other owned firms; deleting one firm also deletes its database row.

Run `python supabase/tests/relational.test.py` with local Supabase running for an isolated PostgreSQL migration/RLS/foreign-key/restore/concurrency regression. Regenerate the relational SQL and the setup text with `python supabase/generate-relational.py` after changing the schema specification.

After `npm run build`, set `RELATIONAL_TEST_DB` to the isolated database name printed by that test and run `node e2e/relational.cjs` for browser loading, saving, repeated refresh, permanent firm cleanup and legacy backup restore checks. The browser routes database requests to the isolated local database; hosted data is not used.


## Development

Requirements: Node 20+.

```bash
npm install
npm start          # http://localhost:3000
npm run test:ci    # unit tests
npm run typecheck  # TypeScript
npm run build      # production build in build/
```

### Project structure

```
src/
  features/
    invoices/   model, numbering, migration, store, editor sections, templates, pages
    resumes/    model, migration, store, editor, paginator, templates, pages
    ats/        ATS scoring engine, Eden AI prompts, wizard, import dialog
    ai/         Eden AI client and API key settings
    profile/    business profile page
  lib/          money, dates, storage, print-to-PDF, colours, files
  ui/           design-system primitives (buttons, fields, sections, dialogs)
public/invoice-motifs/   SVG illustrations for the Seasonal invoice template
scripts/                 generators and review tools for the motifs (use Playwright)
docs/                    production setup, database model and account flow plan
```

Key design decisions:
- **Money** (`src/lib/money.ts`): integer minor units, round half away from zero per line, VAT on the rounded subtotal. RSD uses ISO 4217's two decimals.
- **Pagination** (`src/features/resumes/document/Paginator.tsx`): blocks are measured in a hidden copy and distributed across A4 pages; headings stay with their first entry.
- **ATS score** (`src/features/ats/analyze.ts`): deterministic, so the score means the same thing before and after an AI pass. Eden AI fixes findings; it doesn't grade itself.
- **AI code is lazy-loaded**, so the Eden AI SDK isn't part of the main bundle.

The ninth optional accounting migration, `20261008190000_accounting_attachments.sql`, adds an immutable register for externally retained document and bank-statement attachments. The UI hashes a selected file and stores only its name, exact size, SHA256, source revision and archive reference; it does not upload or back up the original. Withdrawal requires a reason and preserves history. Unknown outcomes retain the original command/key. Disposable file recovery fixtures must match registered metadata when the registry exists.

The tenth optional migration, `20261008200000_accounting_reports.sql`, provides complete internal RSD journal, general ledger and trial balance snapshots with opening movements from earlier entries in the selected fiscal year. Reports include reversals, exclude drafts and reject more than 10000 detail lines rather than truncating. Trial-to-account-to-journal drill-down shares one verified snapshot. Excel exports store every cell as text to preserve exact amounts and literal descriptions. Prior-year carryforward, verified opening migration and historical/foreign-currency/regulatory reports remain unfinished.

The eleventh optional migration, `20261008210000_accounting_partner_reports.sql`, adds current RSD partner cards by account, invoice aging with separate customer/supplier and overpayment totals, and controls comparing payment evidence with actual linked journal lines. It includes all recorded postings across fiscal years and shows independent/manual journal balances separately. Advances are excluded from invoice aging. Zero differences still require active source postings and no unposted evidence before being marked reconciled within scope. One three-sheet Excel export preserves exact text amounts and source IDs. This is a current snapshot, not an historical as-of report; reports reject over 10000 partner lines or 5000 issued invoices/advances without truncation. Business validation and prior milestone dependencies remain open.

The twelfth optional migration, `20261008220000_accounting_fx.sql`, adds immutable EUR/USD/CHF/GBP monetary positions with RSD as functional currency, exact saved rates and explicit revaluation journals. Initial actions create new balanced postings on dedicated partner analytics; they do not convert existing invoices. Rates retain quote units, publication/application dates and a manually retained source reference. NUMERIC integer division and BigInt preserve half-up rounding even for large amounts. Asset/liability increases use explicitly chosen gain/loss accounts. Revaluation cancellation and initial-source reversal are atomic, latest-first and guarded by open periods and revision receipts. Independent movements on the same analytics block inference of remaining foreign principal. Read-only history and exact journal previews are available. Foreign payments, realized settlement differences, currency bank imports, foreign invoices/aging and business policy validation remain unfinished; FX-01 stays in progress.

The thirteenth optional migration, `20261008230000_accounting_fx_settlements.sql`, adds manual evidence-backed partial/full foreign settlements and realized differences for existing dedicated FX positions. Exact carrying allocation uses integer half-up division; final settlement consumes the complete residual. Later revaluation uses only remaining foreign principal. Payment and revaluation reversals follow one latest-active event sequence, restore both currencies atomically and retain immutable source/rate history. Normalized source-account/bank-ID identity prevents reuse across ledger accounts and positions, including cancellations; already registered bank sources require a future linking adapter. UI previews balanced two/three-line postings and preserves identical pending requests after unknown outcomes. This creates new postings; it does not import currency bank files, match existing posted transactions, track the bank account's own foreign principal, process refunds/fees/overpayments or validate actual bank evidence. Business policy and PAY-02 dependencies remain open; FX-01 is still in progress. Production and the original local business database were not migrated.

The fourteenth optional migration, `20261009000000_accounting_fx_bank.sql`, adds immutable declared EUR/USD/CHF/GBP Excel statements and cancellation-aware links to existing manual FX settlements. Import and linking create no journals. Exact balances and both arrival-order metadata checks reject conflicts atomically; source, currency, amount, direction, booking date and cash account must match. Overlapping statements are rejected. Source receipts, firm permissions and one-to-one links prevent duplicate posting; an unknown response requires the identical pending request/key. Statement arithmetic and unmatched coverage do not establish bank opening balances, all-statement continuity or the RSD ledger balance. Native bank adapters, direct posting from imported rows, split settlements, fees/refunds/overpayments and replacement of cancelled bank IDs remain unfinished. See [the foreign bank contract and reference cases](docs/ACCOUNTING_FX_BANK.md). Main backlog remains 14/32 complete, 18 remaining; FX-01 is in progress. Local isolated migrations/backup validation does not migrate production or the original business database.

The fifteenth optional migration, `20261009010000_accounting_fx_bank_posting.sql`, posts each imported foreign bank row once against an explicitly chosen clearing account. Multiple immutable FX allocations consume its remaining foreign/RSD cover and create settlement/realized-difference journals without reposting cash. Final portions consume the exact RSD residual. Outgoing fees use the same clearing pool; unallocated balances stay visible. Source, allocation, fee and cancellation receipts enforce scoped permissions, revisions, open periods and rollback. Bank reversals require reversed dependencies, and allocation reversals require the latest active FX event. Real bank IDs are preserved through relational provenance; existing manual postings retain their separate linking path. Refunds, incoming net fees, cancelled-source replacement, bank-principal revaluation and all-statement continuity remain unfinished. See [the bank posting contract](docs/ACCOUNTING_FX_BANK_POSTING.md). Main backlog remains 14/32 complete, 18 remaining.

The sixteenth optional migration, `20261009100000_accounting_inventory.sql`, adds internal RSD inventory by item/warehouse: exact quantities to three decimals, receipts, moving-average issues, immutable journal-linked stock cards, latest-first reversal, GL reconciliation and four-sheet text Excel exports. Permissions, periods, revisions, source identity and unknown-outcome replay are enforced on the server. See [the inventory contract](docs/ACCOUNTING_INVENTORY.md) and [the delivery status](docs/ACCOUNTING_DELIVERY_STATUS.md). Production and the original business database were not migrated.

The seventeenth optional migration, `20261009110000_accounting_opening.sql`, adds a strict textual Excel opening import with explicit account/partner mapping, a dry preview, one atomic initial journal, individual RSD outstanding items, source hashes and replay receipts. Initial journals remain in the journal register and contribute to opening balances without doubling period turnover. Linking a free existing manual closing line creates no second cash posting; its reversal reopens the item. Corrections preserve the original source and require a pristine ledger. See [the opening migration contract](docs/ACCOUNTING_OPENING.md) for limits and acceptance requirements, and [the delivery status](docs/ACCOUNTING_DELIVERY_STATUS.md) for current progress.

TAX-01 adds a versioned Serbian VAT reference matrix and calculator in the accounting workspace. It includes dated primary-source references and document fingerprints, explicit example tax profiles, exact domestic RSD calculations, and guards for classification, input deduction, advances, corrections and unsupported policy years. It does not persist a firm's tax regime or create tax records; those belong to TAX-02. This block requires no new database migration. See [the tax matrix, applicability dates and reference cases](docs/ACCOUNTING_TAX_RULES.md).

The eighteenth optional migration, `20261009120000_accounting_tax_evidence.sql`, implements the internal part of TAX-02: immutable dated firm profiles, approved/posted invoice tax events, explicit evidence-based input deduction, cancellation history, coverage checks and a four-sheet textual Excel control export. Event registration creates no additional journal; active evidence blocks source reversal and later advance allocation. Period locks, permissions, firm scope, exact source tax, revision races and idempotent replay are enforced server-side. The Excel file is an internal control report, not a PPPDV/POPDV filing. Advances/corrections, deferred/proportional deduction, mixed-regime period consolidation and validated regulatory exports remain unfinished. See [the tax evidence contract](docs/ACCOUNTING_TAX_EVIDENCE.md) and [current delivery status](docs/ACCOUNTING_DELIVERY_STATUS.md).

The nineteenth optional migration, `20261010100000_accounting_tax_profile_endings.sql`, adds prospective endings of used tax profiles with immutable date/reason/author evidence. Source event dates and successor overlap checks use the effective end; the original interval is preserved in the UI and Excel. A status change inside a reporting period still blocks export until mixed-regime consolidation is supported.
