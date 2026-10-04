import { convert, FALLBACK_RSD_PER_EUR } from '../../lib/fx';
import { createId } from '../../lib/files';
import { invoiceTotals, type BusinessProfile, type Invoice, type TaxYear } from './model';

/**
 * Monthly tax and contributions (e.g. the fixed "paušal" amount in Serbia),
 * entered per year because the amount changes every year. Everything is
 * reported in EUR; RSD amounts are converted with the rate saved for that year.
 */

export const createTaxYear = (overrides?: Partial<TaxYear>): TaxYear => ({
  id: createId(),
  year: new Date().getFullYear(),
  monthlyAmount: 0,
  currency: 'RSD',
  rsdPerEur: FALLBACK_RSD_PER_EUR,
  ...overrides
});

export const taxYearFor = (profile: BusinessProfile, year: number): TaxYear | undefined =>
  profile.taxes.find((entry) => entry.year === year && entry.monthlyAmount > 0);

/** Monthly tax in EUR. */
export const monthlyTaxEur = (entry: TaxYear): number => convert(entry.monthlyAmount, entry.currency, 'EUR', entry.rsdPerEur) ?? 0;

/** Months of the year that have started (all 12 for past years, none for future years). */
export const monthsElapsed = (year: number, today = new Date()) => {
  if (year < today.getFullYear()) return 12;
  if (year > today.getFullYear()) return 0;
  return today.getMonth() + 1;
};

const yearOf = (iso: string) => Number(iso.slice(0, 4));

/** An invoice's total in EUR, or null for currencies other than EUR/RSD. */
export const invoiceTotalEur = (invoice: Invoice, rsdPerEur: number): number | null =>
  convert(invoiceTotals(invoice).total, invoice.currency, 'EUR', rsdPerEur);

export type InvoiceNet = { totalEur: number; taxEur: number; netEur: number; year: number };

/** What is left of one invoice after that month's tax (not printed on the invoice). */
export const invoiceNet = (invoice: Invoice, profile: BusinessProfile): InvoiceNet | null => {
  const year = yearOf(invoice.issueDate);
  const entry = taxYearFor(profile, year);
  if (!entry) return null;
  const totalEur = invoiceTotalEur(invoice, entry.rsdPerEur);
  if (totalEur === null) return null;
  const taxEur = monthlyTaxEur(entry);
  return { totalEur, taxEur, netEur: totalEur - taxEur, year };
};

export type YearSummary = { year: number; incomeEur: number; taxEur: number; netEur: number; months: number; hasTax: boolean; skipped: number };

/** Income from sent/paid invoices issued in the year, minus tax for the months so far. */
export const yearSummary = (invoices: Invoice[], profile: BusinessProfile, year: number, today = new Date()): YearSummary => {
  const entry = taxYearFor(profile, year);
  const rate = entry?.rsdPerEur ?? FALLBACK_RSD_PER_EUR;
  let incomeEur = 0;
  let skipped = 0;
  for (const invoice of invoices) {
    if (invoice.status === 'draft' || yearOf(invoice.issueDate) !== year) continue;
    const eur = invoiceTotalEur(invoice, rate);
    if (eur === null) skipped += 1;
    else incomeEur += eur;
  }
  const months = monthsElapsed(year, today);
  const taxEur = entry ? monthlyTaxEur(entry) * months : 0;
  return { year, incomeEur, taxEur, netEur: incomeEur - taxEur, months, hasTax: Boolean(entry), skipped };
};
