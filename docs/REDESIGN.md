# Redesign plan — "make it 300× easier"

## What's wrong today (from screenshots and code)

- **Invoice:** a 7-step wizard. You retype your own business details on every invoice. A client is re-entered every time.
  Invoice numbers are fixed (`InvoiceDavidIvanovic-YYYY-MM`). Items are hours-only. Logo, signature and text are positioned by hand.
- **Resume:** one long accordion. The page reuses invoice wording ("New invoice", "Reset this invoice"). 20 templates of uneven
  quality, each 500+ lines of copy-pasted layout. Percent bars on skills. New resumes start with the author's real data.
- **App shell:** a permanent sidebar takes about a third of the screen for two links.

## Principles

1. **Type once.** Your business details, logo, signature, payment terms and currency live in a profile, and clients in an address book.
   A new invoice is one click and arrives filled in.
2. **One screen.** Form on the left, live A4 preview on the right, no wizard. Everything is visible and editable at a glance.
3. **Smart defaults.** Sequential numbers (`2026-001`), "due in 7 / 14 / 30 days" chips, the next invoice repeats the last one's items for that client.
4. **Few, excellent templates.** Each template is a small layout over shared building blocks, with an accent colour and font pairing.
   Template picker thumbnails render *your* data.
5. **Never lose data.** Versioned storage, migration from the old format (the old key is kept as a backup), a backup
   copy before any reset, and a visible message if storage is full.

## Scope

### Shell
Slim top bar: product name, Invoices | Resumes | Business profile. No sidebar. Responsive: on narrow screens the preview becomes a toggle.

### Invoices
- **List page:** cards/rows with number, client, issue date, total, status (Draft / Sent / Paid / Overdue). Search. "New invoice".
  Actions: duplicate, delete with confirmation, mark paid. Totals summary (unpaid / paid this year).
- **Editor page:** sections Client (pick from the address book or type a new one; saved automatically) → Items (quantity, unit, price;
  Enter adds a row) → Dates & payment → Note → Design (template, colour, document language EN / SR / bilingual).
  "From" shows the profile summary with an edit link.
- **Templates:** Classic, Modern, Minimal, Bold, Seasonal (existing monthly motifs).
- **Profile page:** business details, bank account, logo, signature, defaults (currency, VAT, payment terms, note, number prefix).
- **Money:** `utils/money.ts` (already done). **Dates:** local time, not UTC.

### Resumes
- **List page** like invoices. New resumes start from neutral sample content with a "Start empty" option.
- **Editor:** Personal & photo → Summary → Experience → Education → Skills (tags, no percent bars) → Languages → "Add section"
  (courses, certificates, projects/achievements, internships, references, interests, custom).
- **Templates (6, rebuilt):** Classic (ATS-friendly), Modern sidebar, Minimal, Executive, Creative, Compact. Real multi-page
  pagination by measuring blocks, not hardcoded page counts.

### Engineering
- Feature folders `src/features/{invoices,resumes,profile}` and shared UI primitives in `src/ui`.
- Versioned storage with migrations from the v1 keys (`invoice-generator`, resume key). Tests for migrations and numbering.
- PDF keeps the A4 aspect ratio. The filename is sanitised. Old components are deleted once unused.
