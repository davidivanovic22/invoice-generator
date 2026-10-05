import { createEmptyStore, createInvoice, createLineItem, type Invoice } from '../invoices/model';
import { buildEmail } from '../invoices/email';
import { createBook } from '../kpo/model';
import { buildReminders } from './reminders';

const make = (overrides: Partial<Invoice>): Invoice => {
  const invoice = { ...createInvoice(createEmptyStore()), ...overrides };
  invoice.client = { ...invoice.client, name: 'Wisteria d.o.o.', email: 'office@wisteria.hr' };
  invoice.items = [createLineItem({ quantity: 1, unitPrice: 3300 })];
  return invoice;
};

describe('buildReminders', () => {
  it('lists overdue invoices, the tax deadline, unbooked invoices and drafts', () => {
    const store = createEmptyStore();
    store.invoices = [
      make({ number: '2026-009', status: 'sent', issueDate: '2026-09-01', dueDate: '2026-09-15' }),
      make({ number: '2026-010', status: 'paid', issueDate: '2026-09-30', paidAt: '2026-10-02' }),
      make({ number: '2026-011', status: 'draft', issueDate: '2026-10-01' })
    ];
    store.profile.yearlyTax = { '2026': { monthly: 400, currency: 'EUR', rsdPerEur: 117.2 } };
    const reminders = buildReminders(store, createBook(), '2026-10-12');
    expect(reminders.map((reminder) => reminder.kind)).toEqual(['overdue', 'tax-due', 'kpo', 'drafts']);
    expect(reminders[0]).toMatchObject({ number: '2026-009', days: 27 });
    expect(reminders[1]).toMatchObject({ month: 10, days: 3 });
    expect(reminders[2]).toMatchObject({ count: 1 });
  });

  it('asks for the tax when it is missing and hides the deadline once ticked', () => {
    const store = createEmptyStore();
    store.invoices = [make({ status: 'paid', issueDate: '2026-01-10' })];
    expect(buildReminders(store, createBook(), '2026-10-12').some((reminder) => reminder.kind === 'tax-missing')).toBe(true);
    store.profile.yearlyTax = { '2026': { monthly: 400, currency: 'EUR', rsdPerEur: 117.2, paidMonths: [10] } };
    expect(buildReminders(store, createBook(), '2026-10-12').some((reminder) => reminder.kind === 'tax-due')).toBe(false);
  });
});

describe('buildEmail', () => {
  it('writes a Serbian reminder with the amount, due date and IBAN', () => {
    const invoice = make({ number: '2026-009', status: 'sent', dueDate: '2026-09-15', billingPeriod: 'septembar 2026.' });
    invoice.design.language = 'sr';
    invoice.bank.iban = 'RS35160000000012345678';
    invoice.issuer.name = 'David Ivanović PR';
    const email = buildEmail(invoice, 'reminder', '2026-10-12');
    expect(email.to).toBe('office@wisteria.hr');
    expect(email.subject).toBe('Podsetnik: faktura 2026-009 — rok plaćanja 15.09.2026.');
    expect(email.body).toContain('pre 27 dana');
    expect(email.body).toContain('RS35160000000012345678');
    expect(email.body).toContain('David Ivanović PR');
  });

  it('writes an English invoice email', () => {
    const invoice = make({ number: '2026-010', dueDate: '2026-10-14' });
    invoice.design.language = 'en';
    expect(buildEmail(invoice, 'invoice').subject).toMatch(/^Invoice 2026-010/);
  });
});

it('never ends a Serbian sentence with two dots', () => {
  const invoice = make({ number: '2026-010', dueDate: '2026-10-14' });
  invoice.design.language = 'sr';
  expect(buildEmail(invoice, 'invoice', '2026-10-01').body).not.toContain('..');
  expect(buildEmail(invoice, 'reminder', '2026-10-14').body).not.toContain('..');
});
