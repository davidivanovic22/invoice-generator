import { formatDate, formatDateNumeric } from '../../../lib/dates';
import { formatMinor, formatAmount } from '../../../lib/money';
import { invoiceTotals, type BusinessProfile, type Invoice, type Party } from '../model';
import { makeTranslator, numberLocale } from './labels';

/** Everything a template needs, already formatted. Templates only lay it out. */
export const buildInvoiceView = (invoice: Invoice, profile: BusinessProfile) => {
  const { language } = invoice.design;
  const { t, unit } = makeTranslator(language);
  const locale = numberLocale(language);
  const totals = invoiceTotals(invoice);
  const money = (minor: number) => formatMinor(minor, invoice.currency, locale);
  const date = (iso: string) => (language === 'en' ? formatDate(iso, 'en-GB') : formatDateNumeric(iso));
  const quantity = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(value);

  /** Your own business always shows PIB / Tax ID and Matični broj; a client may use its own labels. */
  const partyLines = (party: Party, own = false) =>
    [
      party.address,
      party.cityCountry,
      party.taxId && `${(!own && party.taxIdLabel) || t('taxId')}: ${party.taxId}`,
      party.regNo && `${(!own && party.regIdLabel) || t('regNo')}: ${party.regNo}`,
      party.email
    ].filter(Boolean) as string[];

  const lines = invoice.items
    .filter((item) => item.title.trim() || item.description.trim() || item.unitPrice !== 0)
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      quantity: `${quantity(item.quantity)} ${unit(item.unit)}`.trim(),
      unitPrice: formatAmount(item.unitPrice, invoice.currency, locale),
      amount: money(totals.linesMinor[invoice.items.indexOf(item)])
    }));

  const meta = [
    { label: t('issueDate'), value: date(invoice.issueDate) },
    { label: t('dueDate'), value: date(invoice.dueDate) },
    invoice.serviceDate && invoice.serviceDate !== invoice.issueDate
      ? { label: t('serviceDate'), value: date(invoice.serviceDate) }
      : null,
    invoice.billingPeriod.trim() ? { label: t('billingPeriod'), value: invoice.billingPeriod } : null
  ].filter(Boolean) as { label: string; value: string }[];

  const payment = [
    invoice.bank.iban && { label: 'IBAN', value: invoice.bank.iban },
    invoice.bank.swift && { label: 'SWIFT / BIC', value: invoice.bank.swift },
    invoice.bank.bankName && { label: t('bank'), value: invoice.bank.bankName },
    invoice.number && { label: t('reference'), value: invoice.number }
  ].filter(Boolean) as { label: string; value: string }[];

  return {
    t,
    accent: invoice.design.accentColor,
    number: invoice.number,
    isPaid: invoice.status === 'paid',
    isCancelled: invoice.status === 'cancelled',
    issuer: { name: invoice.issuer.name, lines: partyLines(invoice.issuer, true) },
    client: { name: invoice.client.name, lines: partyLines(invoice.client) },
    meta,
    lines,
    subtotal: money(totals.subtotalMinor),
    tax: totals.taxMinor !== 0 || invoice.vatPercent > 0 ? money(totals.taxMinor) : null,
    vatLabel: `${t('vat')} ${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(invoice.vatPercent)}%`,
    total: money(totals.totalMinor),
    payment: invoice.bank.iban || invoice.bank.swift || invoice.bank.bankName ? payment : [],
    note: invoice.note.trim(),
    logo: invoice.logo || profile.logo,
    signature: invoice.signature || profile.signature
  };
};

export type InvoiceView = ReturnType<typeof buildInvoiceView>;
