/**
 * Earnings overview: income per month (from the KPO book, plus invoices not
 * booked yet), the flat-rate tax, net earnings, and the two limits a
 * flat-rate taxpayer ("paušalac") in Serbia has to watch.
 */
import { invoiceTotals, paidTaxMonths, type Invoice, type YearTax } from '../invoices/model';
import { invoiceBookingDate, invoicesMissingFromBook, type KpoBook } from '../kpo/model';

/** Yearly income cap for flat-rate taxation (RSD, calendar year). */
export const FLAT_RATE_LIMIT_RSD = 6_000_000;
/** VAT registration threshold (RSD, any 12 consecutive months). */
export const VAT_LIMIT_RSD = 8_000_000;

export type IncomeEvent = { date: string; amount: number; currency: string; planned: boolean; source: 'kpo' | 'invoice' };

/** Converts an amount into the display currency on a date; null when the rate is not known yet. */
export type Converter = (amount: number, currency: string, date: string) => number | null;

/** Every income event: the KPO bookings, plus invoices that are not in the book yet. */
export const incomeEvents = (book: KpoBook, invoices: Invoice[], years: number[], today: string): IncomeEvent[] => [
  ...book.entries.map((entry) => ({
    date: entry.date,
    amount: entry.products + entry.services,
    currency: book.currency,
    planned: entry.date > today,
    source: 'kpo' as const
  })),
  ...years.flatMap((year) =>
    invoicesMissingFromBook(invoices, book, year).map((invoice) => {
      const date = invoiceBookingDate(invoice, book.bookOn);
      return { date, amount: invoiceTotals(invoice).total, currency: invoice.currency, planned: date > today, source: 'invoice' as const };
    })
  )
];

export type MonthRow = {
  month: number;
  income: number;
  planned: number;
  tax: number;
  taxPlanned: boolean;
  net: number;
  /** Some amounts could not be converted yet. */
  incomplete: boolean;
};

/** Monthly tax in the display currency. */
export type TaxForMonth = (month: number) => { amount: number; planned: boolean };

export const monthlyRows = (events: IncomeEvent[], year: number, convert: Converter, taxFor: TaxForMonth): MonthRow[] =>
  Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    let income = 0;
    let planned = 0;
    let incomplete = false;
    for (const event of events) {
      if (!event.date.startsWith(prefix)) continue;
      const value = convert(event.amount, event.currency, event.date);
      if (value === null) {
        incomplete = true;
        continue;
      }
      if (event.planned) planned += value;
      else income += value;
    }
    const tax = taxFor(month);
    return { month, income, planned, tax: tax.amount, taxPlanned: tax.planned, net: income - (tax.planned ? 0 : tax.amount), incomplete };
  });

/** Tax per month: the monthly amount for paid months; months after today are planned. */
export const taxSchedule = (tax: YearTax | undefined, year: number, today: Date, toDisplay: (amount: number, currency: 'EUR' | 'RSD', month: number) => number): TaxForMonth => {
  const paid = new Set(paidTaxMonths(tax, year, today));
  return (month) => {
    if (!tax || tax.monthly <= 0) return { amount: 0, planned: false };
    const amount = toDisplay(tax.monthly, tax.currency, month);
    return paid.has(month) ? { amount, planned: false } : { amount, planned: true };
  };
};

/** Income (not planned) between two dates, inclusive, in RSD. */
export const incomeBetween = (events: IncomeEvent[], from: string, to: string, toRsd: Converter) => {
  let total = 0;
  let incomplete = false;
  for (const event of events) {
    if (event.planned || event.date < from || event.date > to) continue;
    const value = toRsd(event.amount, event.currency, event.date);
    if (value === null) incomplete = true;
    else total += value;
  }
  return { total, incomplete };
};

/** The date one year before (the start of the rolling 12-month window). */
export const yearBefore = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year - 1, month - 1, day + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
