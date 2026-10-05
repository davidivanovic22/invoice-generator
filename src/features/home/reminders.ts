/** Things that need attention today, shown on the home page. */
import { daysBetween, todayIso } from '../../lib/dates';
import { displayStatus, TAX_DUE_DAY, type InvoiceStore } from '../invoices/model';
import { invoicesMissingFromBook, type KpoBook } from '../kpo/model';

export type Reminder =
  | { kind: 'overdue'; invoiceId: string; number: string; client: string; days: number }
  | { kind: 'tax-due'; month: number; days: number }
  | { kind: 'tax-missing'; year: number }
  | { kind: 'kpo'; count: number }
  | { kind: 'drafts'; count: number; invoiceId: string };

export const buildReminders = (store: InvoiceStore, book: KpoBook, today = todayIso()): Reminder[] => {
  const reminders: Reminder[] = [];
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));

  const overdue = store.invoices
    .filter((invoice) => displayStatus(invoice, today) === 'overdue')
    .map((invoice) => ({ invoice, days: daysBetween(invoice.dueDate, today) }))
    .sort((a, b) => b.days - a.days);
  for (const { invoice, days } of overdue.slice(0, 3)) {
    reminders.push({ kind: 'overdue', invoiceId: invoice.id, number: invoice.number, client: invoice.client.name, days });
  }

  const tax = store.profile.yearlyTax[String(year)];
  if (!tax && store.invoices.length) {
    reminders.push({ kind: 'tax-missing', year });
  } else if (tax && day <= TAX_DUE_DAY && TAX_DUE_DAY - day <= 5 && !tax.paidMonths?.includes(month)) {
    reminders.push({ kind: 'tax-due', month, days: TAX_DUE_DAY - day });
  }

  const missing = invoicesMissingFromBook(store.invoices, book, year).length;
  if (missing) reminders.push({ kind: 'kpo', count: missing });

  const drafts = store.invoices.filter((invoice) => invoice.status === 'draft' && invoice.issueDate <= today && invoice.client.name.trim());
  if (drafts.length) reminders.push({ kind: 'drafts', count: drafts.length, invoiceId: drafts[0].id });

  return reminders;
};
