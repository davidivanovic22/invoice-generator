/**
 * Bank statement import: reads incoming payments from a statement exported as
 * Excel or CSV and pairs them with invoices, so they can be marked paid on
 * the day the money actually arrived.
 */
import { addDaysIso } from '../../lib/dates';
import { parseAmount, parseDate } from '../kpo/model';
import type { Cell } from '../kpo/importKpo';
import { invoiceTotals, type Invoice } from './model';

export type Payment = { date: string; amount: number; text: string };

const cellText = (cell: Cell | undefined) => (cell instanceof Date || cell === null || cell === undefined ? '' : String(cell).trim());

const DATE = /datum|date|dat\.|valut[ae]? ?dat/i;
const INFLOW = /priliv|uplat|potra[zž]|odobren|credit|prijem|kredit/i;
const OUTFLOW = /odliv|isplat|dug|zadu[zž]|debit|naplat/i;
const AMOUNT = /iznos|amount|suma|vrednost/i;
const TEXT = /opis|svrha|naziv|platil|nalogodav|partner|korisnik|payer|sender|detail|description|reference|poziv/i;

type Columns = { date: number; inflow: number; outflow: number; amount: number; text: number[] };

const findColumns = (rows: Cell[][]): { columns: Columns; first: number } | null => {
  for (let index = 0; index < Math.min(rows.length, 40); index += 1) {
    const cells = rows[index].map(cellText);
    const date = cells.findIndex((cell) => DATE.test(cell));
    if (date < 0) continue;
    const inflow = cells.findIndex((cell) => INFLOW.test(cell));
    const outflow = cells.findIndex((cell) => OUTFLOW.test(cell));
    const amount = cells.findIndex((cell, column) => AMOUNT.test(cell) && column !== inflow && column !== outflow);
    if (inflow < 0 && amount < 0) continue;
    const text = cells.map((cell, column) => (TEXT.test(cell) && column !== date ? column : -1)).filter((column) => column >= 0);
    return { columns: { date, inflow, outflow, amount, text }, first: index + 1 };
  }
  return null;
};

/** Incoming payments found in a statement, or null when the file does not look like one. */
export const parseStatement = (rows: Cell[][]): Payment[] | null => {
  const found = findColumns(rows);
  if (!found) return null;
  const { columns, first } = found;
  const payments: Payment[] = [];
  for (const row of rows.slice(first)) {
    const date = parseDate(row[columns.date] ?? null);
    if (!date) continue;
    const inflow = columns.inflow >= 0 ? parseAmount(row[columns.inflow] ?? null) : null;
    const single = columns.amount >= 0 ? parseAmount(row[columns.amount] ?? null) : null;
    // With one amount column, a filled outflow column means money went out.
    const outflow = columns.outflow >= 0 ? parseAmount(row[columns.outflow] ?? null) : null;
    const amount = inflow && inflow > 0 ? inflow : single && single > 0 && !(outflow && outflow > 0 && columns.outflow !== columns.amount) ? single : 0;
    if (amount <= 0) continue;
    const textColumns = columns.text.length ? columns.text : row.map((_cell, column) => column).filter((column) => column !== columns.date);
    const text = textColumns
      .map((column) => cellText(row[column]))
      .filter((value) => value && parseAmount(value) === null)
      .join(' · ');
    payments.push({ date, amount: Math.round(amount * 100) / 100, text });
  }
  return payments;
};

export type PaymentMatch = {
  invoice: Invoice;
  payment: Payment;
  /** `exact`: same amount. `fees`: slightly less arrived (bank charges). */
  kind: 'exact' | 'fees';
  /** The invoice is already marked paid, but on another day. */
  fixesDate: boolean;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Up to this much (and 2%) may be missing from a payment because of bank charges. */
const MAX_FEES = 60;

/**
 * Pairs payments with open invoices (and with paid ones whose date differs).
 * Each payment is used once; a payment that names the invoice number or the
 * client wins over one that only has the right amount.
 */
export const matchPayments = (payments: Payment[], invoices: Invoice[]): { matches: PaymentMatch[]; unmatched: Payment[] } => {
  const free = new Set(payments.map((_payment, index) => index));
  const matches: PaymentMatch[] = [];
  const candidates = invoices
    .filter((invoice) => invoice.status === 'sent' || invoice.status === 'paid')
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate));

  for (const invoice of candidates) {
    const total = invoiceTotals(invoice).total;
    const client = normalize(invoice.client.name);
    const number = normalize(invoice.number);
    let best: { index: number; score: number; kind: PaymentMatch['kind'] } | null = null;
    for (const index of Array.from(free)) {
      const payment = payments[index];
      // Money does not arrive long before the invoice exists.
      if (payment.date < addDaysIso(invoice.issueDate, -7)) continue;
      const missing = total - payment.amount;
      const exact = Math.abs(missing) < 0.01;
      const fees = !exact && missing > 0 && missing <= MAX_FEES && missing <= total * 0.02 + 15;
      if (!exact && !fees) continue;
      const text = normalize(payment.text);
      const daysLate = Math.abs(new Date(payment.date).getTime() - new Date(invoice.dueDate).getTime()) / 86_400_000;
      if (daysLate > 120) continue;
      const score = (exact ? 100 : 60) + (number && text.includes(number) ? 50 : 0) + (client && text.includes(client) ? 30 : 0) - daysLate / 10;
      if (!best || score > best.score) best = { index, score, kind: exact ? 'exact' : 'fees' };
    }
    if (!best) continue;
    const payment = payments[best.index];
    if (invoice.status === 'paid' && invoice.paidAt === payment.date) {
      free.delete(best.index);
      continue;
    }
    free.delete(best.index);
    matches.push({ invoice, payment, kind: best.kind, fixesDate: invoice.status === 'paid' });
  }
  return { matches, unmatched: payments.filter((_payment, index) => free.has(index)) };
};
