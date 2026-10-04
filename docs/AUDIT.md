# Audit — invoice-generator

Date: 2026-10-04 · Branch: `new-design` (`f422d5f`) · Scope: invoice module in depth, resume module and tooling at a high level.

## How this was verified

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ✅ passes |
| Lint | `npx eslint src --ext .ts,.tsx` | ⚠️ 0 errors, 23 warnings |
| Tests | `CI=true react-scripts test --watchAll=false` | ❌ **suite fails to run**: `Cannot find module 'react-router-dom' from 'src/App.tsx'` (CRA's Jest 27 cannot resolve react-router 7's ESM exports). The only test still checks the "learn react" boilerplate text. |
| Build | `react-scripts build` | ✅ builds. Main bundle **300 kB gzipped**, no route splitting. **`build/` is 577 MB** (see R6). |
| Dependencies | `npm audit --omit=dev` | ❌ **94 vulnerabilities** (2 critical, 75 high, 11 moderate, 6 low). Almost all come in through `react-scripts` (dev server, Jest, webpack), which are build-time only, but **`react-router-dom` (runtime, direct) is flagged high**. All `react-scripts` dependencies are listed under `dependencies`, which is why `--omit=dev` doesn't filter them out. Most of this goes away with the Vite migration. Upgrade react-router now. |
| Money check | node script reproducing `invoice.ts` + `currency.ts` | ❌ Three lines of 1 × 10.005 each display **€10.01**, but the subtotal displays **€30.02** (see R1). |

## Risks, ranked by user impact

### Critical — wrong money or lost data

**R1. Invoice totals can disagree with their own line items.** `src/utils/invoice.ts:194-204`
Totals are summed from unrounded floats (`hours * rate`). Rounding only happens at display time,
inside `Intl.NumberFormat`. The printed lines don't add up to the printed subtotal (reproduced above),
and VAT is computed on the unrounded subtotal. On a legal document this is a correctness bug, not a cosmetic one.
*Correction to the brief:* the code does not use `toFixed`/`parseFloat`. It has **no rounding policy at all**.

**R2. Corrupted or unreadable storage is silently overwritten.** `src/utils/storage.ts:212`, `src/hooks/useInvoices.ts:19-39`
If `JSON.parse` fails, `loadInvoicesState` returns `null`. The hook then creates a fresh invoice, and the
`useEffect` immediately saves it over the original key. The user's data is destroyed, with no backup and no message.
`src/utils/resumeStorage.ts:136-160` has the same pattern.

**R3. "Import JSON" of a full backup replaces all invoices with no confirmation.** `src/hooks/useInvoices.ts:279-300`
An `InvoicesState` file goes straight into `setState` and discards every existing invoice. There's no schema
validation either: anything with an `invoices` array is accepted, and `normalizeInvoice` turns garbage into blank invoices.

**R4. Saving can crash the app when storage is full.** `src/utils/storage.ts:218`
Logos and signatures are stored as base64 data URLs (`InvoicePage.tsx:79`, `SignatureField.tsx:29`). Once the
~5 MB localStorage quota is reached, `setItem` throws inside a `useEffect`. There's no try/catch and no error
boundary (`src/App.tsx`), so the whole app unmounts to a blank page.

### High — wrong document content

**R5. Invoice numbers are hardcoded and not unique.** `src/utils/invoice.ts:12-18`
Every invoice gets `InvoiceDavidIvanovic-YYYY-MM`. Two invoices in the same month share a number, and
"Duplicate" (`useInvoices.ts:80`) creates a collision. Sequential, unique numbering is a legal requirement in Serbia.
The dead file `src/utils/format.ts:51-57` has a different, random generator.

**R6. Dates are computed in UTC, not local time.** `src/utils/dates.ts:1-9`
`toISOString().slice(0, 10)` returns the UTC date. In Serbia (UTC+1/+2), an invoice created between 00:00 and
02:00 gets **yesterday's** issue date. The due date drifts the same way.

**R7. No input validation.** `src/components/sidebar/ItemsEditor.tsx:61,69`, `InvoiceMetaForm.tsx:57`
Negative hours, rates and VAT are accepted, and an invalid number silently becomes `0`. Nothing checks that
required fields are filled, nor the PIB/MB/IBAN format.

**R8. Money formatting is inconsistent between components.** `currency.ts:2` uses `en-IE`, while
`InvoiceEditorPreview.tsx:29` and `InvoicePrintPreview.tsx:18` use their own `en-US` formatters. The locale is
hardcoded and there's no `sr-Latn-RS` option for RSD invoices.

### Medium — quality, performance, maintainability

**R9. PDFs are raster screenshots.** `src/utils/pdf.ts:63-118`
The page is rendered with html2canvas at 2–3× scale, embedded as PNG, and **stretched to A4 regardless of the
source aspect ratio** (`addImage(…, 0, 0, pdfWidth, pdfHeight)`). The text can't be selected or searched, files are
large, and output can look slightly distorted. Preview uses `window.open`, which popup blockers can stop.
The filename comes straight from `invoiceNumber` without sanitising (`InvoicePage.tsx:109`).

**R10. The build ships hundreds of MB of unused assets.** CRA copies all of `public/`, including the git-ignored
`invoice-watermarks/` (180 MB), two zips (179 MB each) and `monthly-themes/` (32 MB), none of which are referenced in `src/`.
Deployed from a local checkout, this would upload ~577 MB.

**R11. The test suite is broken, and there's no CI.** See the verification table. Nothing protects R1–R8 from regressions.

**R12. Duplicate defaults that already disagree.** `ensureRequiredElements` exists in both `invoice.ts:59-100` and
`storage.ts:43-82`, with different signature defaults (y `980` vs `760`, height `80`/`72`; `signatureHeight` `80` vs `56`).
Default elements in `storage.ts:14-33` generate their UUID once, at module load.

**R13. Dead code.** Not imported anywhere: `components/invoice/InvoiceHeader.tsx`, `InvoiceItemsTable.tsx`,
`InvoiceNote.tsx`, `InvoiceSummary.tsx`, `PartyDetailsCard.tsx`, `components/resume/editors/ResumeEditorSectionCard.tsx`,
and `utils/format.ts`, which duplicates `currency.ts` + `dates.ts`.

**R14. Large components.** `ResumeBlocks.tsx` (976 lines), `useResumes.ts` (695), `InvoiceEditorPreview.tsx` (541),
and several resume templates over 500 lines. The editor preview and print preview duplicate the layout and the totals logic.

**R15. Personal data is hardcoded as defaults.** Besides R5, `src/utils/resume.ts:27-33` seeds every new resume with
your real name, email, LinkedIn and GitHub. That's fine for personal use, but wrong for a product.

### Low

- The page title is still `React App` (`public/index.html:27`), and the meta description is the CRA default.
- 23 ESLint warnings. TypeScript 4.9 with React 19 types. `react-scripts` is deprecated.
- No `.nvmrc`/`engines`, Prettier, `.editorconfig` or pre-commit hooks. The README is the CRA boilerplate.
- A11y not yet audited. The drag editor almost certainly can't be used with a keyboard (to verify in Phase 6).

## Recommended roadmap (adjusted from the brief)

The audit changes the order. R1–R4 are live bugs that cost money or data, so a **Phase 0.5 "stop the bleeding"**
comes before the full Vite migration. Each fix is small and can be shipped on the current toolchain.
The test runner has to work first, because the fixes need tests.

| # | Item | Fixes | Size |
|---|---|---|---|
| **0.5a** | Make tests runnable: add Vitest alongside CRA (or a Jest `moduleNameMapper` workaround); delete the boilerplate test | R11 | S |
| **0.5b** | Money module: integer minor units, round per line, documented VAT rounding, one formatter. Full unit tests | R1, R8 | M |
| **0.5c** | Storage safety: back up unreadable data before resetting, try/catch on save with a visible "storage full" error, app-level error boundary | R2, R4 | S |
| **0.5d** | Import: Zod schema, preview of what will change, confirmation before replacing, "merge" by default | R3 | S |
| **0.5e** | Local-time dates. Configurable, sequential invoice numbering (prefix + counter per year) with a uniqueness check | R5, R6 | S |
| **0.5f** | Upgrade `react-router-dom` to a patched version (runtime vulnerability) | Deps | S |
| 0 | Vite + TS 5 + ESLint flat config + Prettier + husky + `.nvmrc`. Move unused assets out of `public/` | R10, Low | M |
| 1 | Zod validation in forms (non-negative numbers, required fields, PIB 9 digits, MB 8 digits, IBAN checksum) | R7 | M |
| 2 | Versioned storage envelope + migrations. Logos/signatures in IndexedDB | R4 (fully) | M |
| 3 | Delete dead code. Unify the duplicated defaults. Split large components. Shared invoice layout for editor and print. Lazy-load resume + PDF | R12–R14 | L |
| 4 | Vector PDF prototype (`@react-pdf/renderer` vs print CSS), correct aspect ratio, sanitised filenames, č/ć/ž/š/đ fonts | R9 | M–L |
| 5 | RTL flow tests, Playwright E2E + visual snapshots per theme, GitHub Actions, bundle-size budget | R11 | M |
| 6 | A11y (keyboard drag, axe), i18n `sr-Latn`/`en`, undo/redo | Low | L |
| 7 | README, ARCHITECTURE, ADRs, CONTRIBUTING, deploy previews, CSP. Remove personal defaults | R15, Low | S–M |

**Proposed next step:** start with 0.5a, then 0.5b, each as its own PR, and wait for review before continuing.
Decisions needed from you are listed below.

## Open questions for the owner

1. **Rounding policy.** Round each line to 2 decimals, then sum (common for Serbian invoices). Or sum, then round once?
   Is VAT computed per line or on the subtotal? (Recommendation: per-line rounding, VAT on the rounded subtotal.)
2. **Invoice numbering format.** For example `2026-001`, with the counter resetting every year. Should the prefix be configurable per issuer?
3. **Personal defaults.** Is this a personal tool (keep your details as defaults, but move them to a settings screen)
   or a product for other users (remove them)?
4. **Deployment target** (Vercel, Netlify, Cloudflare Pages, or none)? This affects Phase 0 and Phase 7.
