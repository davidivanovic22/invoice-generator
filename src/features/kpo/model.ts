/**
 * KPO knjiga — "Knjiga o ostvarenom prometu paušalno oporezovanih obveznika".
 *
 * Each entry is one booking: a date, a description and the income from
 * products (column 3) and from services (column 4). Entries are stored, not
 * derived, so the book stays exactly as it was filed even if an invoice
 * changes later. Invoices are added explicitly and remember their invoiceId.
 */
import { createId } from '../../lib/files';
import { formatDateNumeric, todayIso } from '../../lib/dates';
import { invoiceTotals, type Invoice, type Party } from '../invoices/model';

export type KpoCurrency = 'EUR' | 'RSD';

export type KpoEntry = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  /** Column 3: income from selling products. */
  products: number;
  /** Column 4: income from services. */
  services: number;
  source: 'invoice' | 'import' | 'manual';
  invoiceId: string | null;
};

export type KpoHeader = {
  pib: string;
  taxpayer: string;
  business: string;
  seat: string;
  taxpayerCode: string;
  activity: string;
};

export type KpoBook = {
  version: 1;
  currency: KpoCurrency;
  header: KpoHeader;
  /** How invoices are described, e.g. "Usluge računarskog programiranja ({client})". */
  entryTemplate: string;
  /** Which invoice date is booked. */
  bookOn: 'paid' | 'issued';
  entries: KpoEntry[];
};

export const DEFAULT_TEMPLATE = 'Usluge računarskog programiranja ({client})';

export const createHeader = (party?: Party): KpoHeader => ({
  pib: party?.taxId ?? '',
  taxpayer: '',
  business: party?.name ?? '',
  seat: [party?.address, party?.cityCountry].filter(Boolean).join(', '),
  taxpayerCode: '',
  activity: '6201 – Računarsko programiranje'
});

export const createBook = (party?: Party): KpoBook => ({
  version: 1,
  currency: 'EUR',
  header: createHeader(party),
  entryTemplate: DEFAULT_TEMPLATE,
  bookOn: 'paid',
  entries: []
});

export const createEntry = (overrides?: Partial<KpoEntry>): KpoEntry => ({
  id: createId(),
  date: todayIso(),
  description: '',
  products: 0,
  services: 0,
  source: 'manual',
  invoiceId: null,
  ...overrides
});

export const entryTotal = (entry: Pick<KpoEntry, 'products' | 'services'>) => round2(entry.products + entry.services);

export const round2 = (value: number) => Math.round(value * 100) / 100;

const byDate = (a: KpoEntry, b: KpoEntry) => a.date.localeCompare(b.date);

/** Entries of one year in booking order, with their ordinal number (redni broj). Future entries are planned and get no number. */
export const bookYear = (book: KpoBook, year: number, today = todayIso()) => {
  const rows = book.entries.filter((entry) => entry.date.startsWith(String(year))).sort(byDate);
  let number = 0;
  return rows.map((entry) => {
    const planned = entry.date > today;
    if (!planned) number += 1;
    return { entry, number: planned ? null : number, planned };
  });
};

export const yearTotals = (rows: { entry: KpoEntry; planned: boolean }[], includePlanned = false) =>
  rows
    .filter((row) => includePlanned || !row.planned)
    .reduce(
      (sum, { entry }) => ({
        products: round2(sum.products + entry.products),
        services: round2(sum.services + entry.services),
        total: round2(sum.total + entryTotal(entry))
      }),
      { products: 0, services: 0, total: 0 }
    );

export const bookYears = (book: KpoBook) => Array.from(new Set(book.entries.map((entry) => Number(entry.date.slice(0, 4))))).sort((a, b) => b - a);

/** "Usluge … (Wisteria d.o.o.) 15.01.2026." — the date is appended, as on the paper form. */
export const describeWithDate = (entry: Pick<KpoEntry, 'description' | 'date'>) => `${entry.description} ${formatDateNumeric(entry.date)}`.trim();

/* ---------- Invoices → entries ---------- */

/** The date an invoice is booked on. */
export const invoiceBookingDate = (invoice: Invoice, bookOn: KpoBook['bookOn']) =>
  bookOn === 'paid' ? invoice.paidAt ?? invoice.issueDate : invoice.issueDate;

export const invoiceDescription = (invoice: Invoice, template: string) =>
  (template || DEFAULT_TEMPLATE).replace('{client}', invoice.client.name.trim() || '—').replace('{number}', invoice.number);

/**
 * Builds the entry for an invoice. `rate` converts the invoice currency into
 * the book's currency (1 when they match); null means the rate is not known yet.
 */
export const entryFromInvoice = (invoice: Invoice, book: KpoBook, rate: number | null): KpoEntry | null => {
  if (rate === null) return null;
  return createEntry({
    date: invoiceBookingDate(invoice, book.bookOn),
    description: invoiceDescription(invoice, book.entryTemplate),
    services: round2(invoiceTotals(invoice).total * rate),
    source: 'invoice',
    invoiceId: invoice.id
  });
};

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'dj')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Finds a stored entry that already books this invoice: linked by id, or (for
 * imported books) same client in the description, the same amount and a date
 * within 60 days.
 */
export const findEntryForInvoice = (invoice: Invoice, entries: KpoEntry[], amountInBook: number | null, bookOn: KpoBook['bookOn']) => {
  const linked = entries.find((entry) => entry.invoiceId === invoice.id);
  if (linked) return linked;
  const client = normalize(invoice.client.name);
  const date = new Date(invoiceBookingDate(invoice, bookOn)).getTime();
  return (
    entries.find((entry) => {
      if (entry.invoiceId) return false;
      if (amountInBook === null || Math.abs(entryTotal(entry) - amountInBook) > 0.5) return false;
      if (client && !normalize(entry.description).includes(client)) return false;
      return Math.abs(new Date(entry.date).getTime() - date) <= 60 * 86_400_000;
    }) ?? null
  );
};

/** Invoices that should be in the book: issued (not drafts), and paid when booking on payment. */
export const bookableInvoices = (invoices: Invoice[], bookOn: KpoBook['bookOn']) =>
  invoices.filter((invoice) => (bookOn === 'paid' ? invoice.status === 'paid' : invoice.status !== 'draft'));

/* ---------- Parsing Serbian spreadsheets ---------- */

/** "1.234.567,89", "1,234.56", "2206", "2 206,00 €" → number. */
export const parseAmount = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value.replace(/[^\d,.-]/g, '');
  if (!text || !/\d/.test(text)) return null;
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma > lastDot) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && lastComma >= 0) {
    text = text.replace(/,/g, '');
  } else if (lastComma < 0 && /^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    // "2.206" or "1.234.567" use dots for thousands.
    text = text.replace(/\./g, '');
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

const pad = (value: number) => String(value).padStart(2, '0');

/** "15.01.2026.", "15.1.2026", "2026-01-15", a JS Date or an Excel serial number → YYYY-MM-DD. */
export const parseDate = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const date = new Date(Math.round((value - 25569) * 86_400_000));
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }
  if (typeof value !== 'string') return null;
  const serbian = /(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/.exec(value);
  if (serbian) return validDate(Number(serbian[3]), Number(serbian[2]), Number(serbian[1]));
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const slashed = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(value);
  if (slashed) return validDate(Number(slashed[3]), Number(slashed[2]), Number(slashed[1]));
  return null;
};

const validDate = (year: number, month: number, day: number) => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
};

/** Splits "Usluge … (Wisteria d.o.o.) 15.01.2026." into its description and date. */
export const splitDescriptionDate = (text: string): { description: string; date: string | null } => {
  const match = /^(.*?)[\s,;-]*(\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*\d{4}\.?)\s*$/.exec(text.trim());
  if (match) return { description: match[1].trim(), date: parseDate(match[2]) };
  const leading = /^(\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*\d{4}\.?)[\s,;-]*(.*)$/.exec(text.trim());
  if (leading) return { description: leading[2].trim(), date: parseDate(leading[1]) };
  return { description: text.trim(), date: null };
};
