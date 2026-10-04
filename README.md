# Paperwork: invoices & resumes

Create professional invoices and ATS-ready resumes in minutes. Everything runs in the browser, with no account and no server. Your data stays on your device.

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
- **Taxes and contributions per year:** enter your monthly amount (e.g. the flat-rate *paušal*) in RSD or EUR; RSD is converted with a rate saved for that year (today's rate fetched on request, or typed in). Every invoice shows what is left after that month's tax (not printed), and the invoice list has a year overview: invoiced, tax so far, left for you. Downloading a draft marks it as sent.
- **Type it once.** Business details, bank account, logo, signature and defaults live in the business profile, so every new invoice arrives filled in.
- **Client address book.** Clients are saved automatically; start typing a name to reuse one, and repeat the last invoice's items in one click.
- **Correct numbers.** Amounts are computed in integer minor units: every line is rounded, the subtotal is the sum of the printed lines, and VAT is applied once. Sequential numbering (`2026-001`) warns about duplicates.
- **Five templates** (Modern, Classic, Minimal, Bold, Seasonal with monthly illustrations), with accent colours, in English, Serbian or both.
- **Status tracking:** draft, sent, paid and overdue, with outstanding and paid totals.

### Resumes
- **Six templates** (Modern, Classic/ATS, Minimal, Executive, Creative, Compact) with real multi-page pagination.
- Ordered sections you can rename, hide and reorder; new resumes start from a well-written example or empty.
- **ATS check:** an instant, offline score from 0 to 100 with prioritised findings. Paste a job ad to measure keyword coverage.
- **Claude AI (optional, bring your own key):**
  - *Improve with AI to 95+* rewrites the headline, summary and bullet points, then re-scores until the target is reached.
  - *Fix step by step* lets you review every change with an editable before/after view.
  - *Import existing CV* reads a PDF, Word or text resume and rebuilds it in the editor.
  - It never invents facts: unknown numbers become `[X%]` placeholders for you to fill in, and skills from the job ad must be confirmed by you.

### Export
PDFs are produced by the browser's print engine (**Download PDF**, then choose **Save as PDF**). They contain real, selectable text that ATS parsers and accounting tools can read.

## Using Claude AI

1. Create an API key at [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. Click **Connect AI** in the header and paste it.

The key is stored only in your browser's local storage and sent only to `api.anthropic.com`. You are billed by Anthropic directly; a full resume optimisation typically costs a few cents. The app uses `claude-opus-5-5` with structured outputs and server-side refusal fallbacks.

## Your data

Everything is saved in `localStorage` (`studio.invoices.v2`, `studio.resumes.v2`). Use **Backup** on the list pages to export JSON, and **Import** / **Restore backup** to bring it back; imports merge and never overwrite existing documents. Data from older versions of the app is migrated automatically, and the old keys are kept as a backup. If saved data is ever unreadable, a copy is stored under a `.backup.<date>` key before anything else happens.

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
    ats/        ATS scoring engine, Claude prompts, wizard, import dialog
    ai/         Claude client and API key settings
    profile/    business profile page
  lib/          money, dates, storage, print-to-PDF, colours, files
  ui/           design-system primitives (buttons, fields, sections, dialogs)
public/invoice-motifs/   SVG illustrations for the Seasonal invoice template
scripts/                 generators and review tools for the motifs (use Playwright)
docs/                    audit, redesign plan
```

Key design decisions:
- **Money** (`src/lib/money.ts`): integer minor units, round half away from zero per line, VAT on the rounded subtotal. RSD uses ISO 4217's two decimals.
- **Pagination** (`src/features/resumes/document/Paginator.tsx`): blocks are measured in a hidden copy and distributed across A4 pages; headings stay with their first entry.
- **ATS score** (`src/features/ats/analyze.ts`): deterministic, so the score means the same thing before and after an AI pass. Claude fixes findings; it doesn't grade itself.
- **AI code is lazy-loaded**, so the Anthropic SDK isn't part of the main bundle.
