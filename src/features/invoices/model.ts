import { addDaysIso, daysBetween, monthLabel, todayIso } from '../../lib/dates';
import { createId } from '../../lib/files';
import { computeTotals, fromMinor } from '../../lib/money';

export type InvoiceStatus = 'draft' | 'sent' | 'paid';
export type DocLanguage = 'en' | 'sr' | 'en-sr';
export type InvoiceTemplateId = 'classic' | 'modern' | 'minimal' | 'bold' | 'seasonal';
export type MonthKey =
  | 'january'
  | 'february'
  | 'march'
  | 'april'
  | 'may'
  | 'june'
  | 'july'
  | 'august'
  | 'september'
  | 'october'
  | 'november'
  | 'december';

export const MONTHS: MonthKey[] = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
];

export type Party = {
  name: string;
  address: string;
  cityCountry: string;
  taxIdLabel: string;
  taxId: string;
  regIdLabel: string;
  regNo: string;
  email: string;
};

export type BankDetails = { iban: string; swift: string; bankName: string };

export type LineItem = {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type InvoiceDesign = {
  template: InvoiceTemplateId;
  accentColor: string;
  language: DocLanguage;
  /** Seasonal template only: null follows the issue date's month. */
  seasonalMonth: MonthKey | null;
  /** Seasonal template only: null picks a variant from the year. */
  seasonalVariant: number | null;
};

export type Invoice = {
  id: string;
  number: string;
  status: InvoiceStatus;
  issueDate: string;
  serviceDate: string;
  dueDate: string;
  billingPeriod: string;
  currency: string;
  vatPercent: number;
  issuer: Party;
  bank: BankDetails;
  client: Party;
  clientId: string | null;
  items: LineItem[];
  note: string;
  /** Per-invoice override; empty means "use the business profile's". */
  logo: string;
  signature: string;
  design: InvoiceDesign;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Client = { id: string; party: Party; currency: string; lastUsedAt: string };

/** The fixed monthly tax ("paušal") for one year; it changes every year. */
export type YearTax = { monthly: number; currency: 'EUR' | 'RSD'; /** RSD for 1 EUR, used when the amount is in RSD. */ rsdPerEur: number };

export type BusinessProfile = {
  party: Party;
  bank: BankDetails;
  logo: string;
  signature: string;
  /** Keyed by year, e.g. "2026". */
  yearlyTax: Record<string, YearTax>;
  defaults: {
    currency: string;
    vatPercent: number;
    paymentDays: number;
    note: string;
    numberPrefix: string;
    language: DocLanguage;
    template: InvoiceTemplateId;
    accentColor: string;
    unit: string;
  };
};

export type InvoiceStore = {
  version: 2;
  invoices: Invoice[];
  clients: Client[];
  profile: BusinessProfile;
};

export const CURRENCIES = ['EUR', 'RSD', 'USD', 'GBP', 'CHF', 'BAM', 'HUF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK'];
export const UNITS = ['h', 'day', 'pcs', 'month', 'project', 'km'];

export const createParty = (overrides?: Partial<Party>): Party => ({
  name: '',
  address: '',
  cityCountry: '',
  taxIdLabel: '',
  taxId: '',
  regIdLabel: '',
  regNo: '',
  email: '',
  ...overrides
});

export const createBank = (overrides?: Partial<BankDetails>): BankDetails => ({
  iban: '',
  swift: '',
  bankName: '',
  ...overrides
});

export const createProfile = (overrides?: Partial<BusinessProfile>): BusinessProfile => ({
  party: createParty(),
  bank: createBank(),
  logo: '',
  signature: '',
  yearlyTax: {},
  ...overrides,
  defaults: {
    currency: 'EUR',
    vatPercent: 0,
    paymentDays: 14,
    note: '',
    numberPrefix: '',
    language: 'en',
    template: 'modern',
    accentColor: '#4f46e5',
    unit: 'h',
    ...overrides?.defaults
  }
});

export const createLineItem = (overrides?: Partial<LineItem>): LineItem => ({
  id: createId(),
  title: '',
  description: '',
  quantity: 1,
  unit: 'h',
  unitPrice: 0,
  ...overrides
});

export const createEmptyStore = (): InvoiceStore => ({
  version: 2,
  invoices: [],
  clients: [],
  profile: createProfile()
});

const NUMBER_PATTERN = /^(.*?)(\d{4})-(\d+)$/;

/** Next sequential number for the year: "2026-001", "2026-002", … (with optional prefix). */
export const nextInvoiceNumber = (invoices: Invoice[], prefix: string, issueDate = todayIso()): string => {
  const year = issueDate.slice(0, 4);
  let highest = 0;
  let width = 3;
  for (const invoice of invoices) {
    const match = NUMBER_PATTERN.exec(invoice.number.trim());
    if (!match || match[1] !== prefix || match[2] !== year) continue;
    highest = Math.max(highest, Number(match[3]));
    width = Math.max(width, match[3].length);
  }
  return `${prefix}${year}-${String(highest + 1).padStart(width, '0')}`;
};

export const isNumberTaken = (invoices: Invoice[], number: string, exceptId?: string) =>
  invoices.some((invoice) => invoice.id !== exceptId && invoice.number.trim() === number.trim());

/** "October 2026" or "oktobar 2026." depending on the document language. */
export const periodLabel = (iso: string, language: DocLanguage) =>
  language === 'en' ? monthLabel(iso, 'en-US') : `${monthLabel(iso, 'sr-Latn-RS').replace(/\.$/, '')}.`;

/** Matches the period label in any language, to tell an untouched default from a custom value. */
export const isDefaultPeriod = (value: string, iso: string) => [periodLabel(iso, 'en'), periodLabel(iso, 'sr'), monthLabel(iso)].includes(value);

export const createInvoice = (store: InvoiceStore, overrides?: Partial<Invoice>): Invoice => {
  const { profile } = store;
  const today = todayIso();
  const now = new Date().toISOString();
  return {
    id: createId(),
    number: nextInvoiceNumber(store.invoices, profile.defaults.numberPrefix, today),
    status: 'draft',
    issueDate: today,
    serviceDate: today,
    dueDate: addDaysIso(today, profile.defaults.paymentDays),
    billingPeriod: periodLabel(today, profile.defaults.language),
    currency: profile.defaults.currency,
    vatPercent: profile.defaults.vatPercent,
    issuer: { ...profile.party },
    bank: { ...profile.bank },
    client: createParty(),
    clientId: null,
    items: [createLineItem({ unit: profile.defaults.unit })],
    note: profile.defaults.note,
    logo: '',
    signature: '',
    design: {
      template: profile.defaults.template,
      accentColor: profile.defaults.accentColor,
      language: profile.defaults.language,
      seasonalMonth: null,
      seasonalVariant: null
    },
    paidAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
};

/** A fresh draft that repeats another invoice's client, items and design. */
export const duplicateInvoice = (store: InvoiceStore, source: Invoice): Invoice => {
  const fresh = createInvoice(store);
  return {
    ...fresh,
    currency: source.currency,
    vatPercent: source.vatPercent,
    client: { ...source.client },
    clientId: source.clientId,
    items: source.items.map((item) => ({ ...item, id: createId() })),
    note: source.note,
    logo: source.logo,
    signature: source.signature,
    design: { ...source.design, seasonalMonth: null, seasonalVariant: null }
  };
};

export const invoiceTotals = (invoice: Pick<Invoice, 'items' | 'vatPercent' | 'currency'>) => {
  const totals = computeTotals(
    invoice.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })),
    invoice.vatPercent,
    invoice.currency
  );
  return {
    linesMinor: totals.lines,
    subtotalMinor: totals.subtotal,
    taxMinor: totals.tax,
    totalMinor: totals.total,
    total: fromMinor(totals.total, invoice.currency)
  };
};

export type DisplayStatus = InvoiceStatus | 'overdue';

export const displayStatus = (invoice: Invoice, today = todayIso()): DisplayStatus =>
  invoice.status === 'sent' && daysBetween(invoice.dueDate, today) > 0 ? 'overdue' : invoice.status;

export const partyIsEmpty = (party: Party) => !party.name.trim() && !party.address.trim() && !party.taxId.trim();

export const sameClient = (a: Party, b: Party) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

/* ---------- Yearly tax ---------- */

const toEur = (amount: number, currency: string, rsdPerEur: number): number | null =>
  currency === 'EUR' ? amount : currency === 'RSD' && rsdPerEur > 0 ? amount / rsdPerEur : null;

/** Months of the year that have started: all 12 for past years, none for future ones. */
export const monthsSoFar = (year: number, today = new Date()) =>
  year < today.getFullYear() ? 12 : year > today.getFullYear() ? 0 : today.getMonth() + 1;

/** Tax paid so far in the year, in EUR (monthly amount × months so far). */
export const taxSpentEur = (tax: YearTax | undefined, year: number, today = new Date()) => {
  if (!tax || tax.monthly <= 0) return 0;
  return (toEur(tax.monthly, tax.currency, tax.rsdPerEur) ?? 0) * monthsSoFar(year, today);
};

/** Paid income for the year in EUR (RSD converted with the year's rate); other currencies are left out. */
export const paidIncomeEur = (invoices: Invoice[], year: number, rsdPerEur: number) => {
  let total = 0;
  let skipped = 0;
  for (const invoice of invoices) {
    if (invoice.status !== 'paid' || !invoice.issueDate.startsWith(String(year))) continue;
    const eur = toEur(invoiceTotals(invoice).total, invoice.currency, rsdPerEur);
    if (eur === null) skipped += 1;
    else total += eur;
  }
  return { total, skipped };
};
