/** Key figures of one firm, read straight from its saved data (for the accountant's firm list). */
import { cachedRate } from '../../lib/nbs';
import { normalizeStore } from '../invoices/migrate';
import { displayStatus, invoiceTotals, type InvoiceStore } from '../invoices/model';
import { bookYear, invoicesMissingFromBook, type KpoBook } from '../kpo/model';
import { normalizeBook } from '../kpo/store';
import { FLAT_RATE_LIMIT_RSD } from '../overview/model';

export type FirmSummary = {
  name: string;
  taxId: string;
  invoiceCount: number;
  /** Income booked this year (KPO book, or paid invoices when there is no book), in EUR. */
  incomeEur: number;
  fromBook: boolean;
  /** Share of the yearly flat-rate limit, 0–1+. */
  limitShare: number;
  unpaidEur: number;
  overdue: number;
  missingFromBook: number;
  taxEntered: boolean;
  lastActivity: string | null;
};

const parse = (raw: string | null) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const summarizeFirm = (invoicesRaw: string | null, kpoRaw: string | null, year: number, today: string): FirmSummary => {
  const store: InvoiceStore = normalizeStore(parse(invoicesRaw) ?? {});
  const book: KpoBook = normalizeBook(parse(kpoRaw));
  const fallbackRate = store.profile.yearlyTax[String(year)]?.rsdPerEur ?? 117.2;
  const eurRate = (date: string) => cachedRate('EUR', date) ?? fallbackRate;
  /** Amount in RSD on a date. */
  const toRsd = (amount: number, currency: string, date: string) => {
    if (currency === 'RSD') return amount;
    const rate = cachedRate(currency, date) ?? (currency === 'EUR' ? fallbackRate : null);
    return rate === null ? 0 : amount * rate;
  };

  const booked = bookYear(book, year, today).filter((row) => !row.planned);
  const fromBook = booked.length > 0;
  const incomeRsd = fromBook
    ? booked.reduce((sum, { entry }) => sum + toRsd(entry.products + entry.services, book.currency, entry.date), 0)
    : store.invoices
        .filter((invoice) => invoice.status === 'paid' && invoice.issueDate.startsWith(String(year)))
        .reduce((sum, invoice) => sum + toRsd(invoiceTotals(invoice).total, invoice.currency, invoice.issueDate), 0);

  const unpaid = store.invoices.filter((invoice) => ['sent', 'overdue'].includes(displayStatus(invoice, today)));
  const unpaidRsd = unpaid.reduce((sum, invoice) => sum + toRsd(invoiceTotals(invoice).total, invoice.currency, invoice.issueDate), 0);

  return {
    name: store.profile.party.name.trim(),
    taxId: store.profile.party.taxId.trim(),
    invoiceCount: store.invoices.length,
    incomeEur: incomeRsd / eurRate(today),
    fromBook,
    limitShare: incomeRsd / FLAT_RATE_LIMIT_RSD,
    unpaidEur: unpaidRsd / eurRate(today),
    overdue: unpaid.filter((invoice) => displayStatus(invoice, today) === 'overdue').length,
    missingFromBook: fromBook ? invoicesMissingFromBook(store.invoices, book, year).length : 0,
    taxEntered: Boolean(store.profile.yearlyTax[String(year)]),
    lastActivity: store.invoices.map((invoice) => invoice.updatedAt).sort().pop() ?? null
  };
};
