import { createEntry } from '../kpo/model';
import { createBook } from '../kpo/model';
import { incomeBetween, incomeEvents, monthlyRows, taxSchedule, yearBefore } from './model';

describe('overview', () => {
  const book = createBook();
  book.entries = [
    createEntry({ date: '2026-01-15', services: 2206 }),
    createEntry({ date: '2026-01-28', services: 100 }),
    createEntry({ date: '2026-03-10', services: 3000 }),
    createEntry({ date: '2026-11-14', services: 3300 })
  ];
  const events = incomeEvents(book, [], [2026], '2026-10-05');
  const identity = (amount: number) => amount;

  it('sums income per month and keeps planned income apart', () => {
    const tax = taxSchedule({ monthly: 400, currency: 'EUR', rsdPerEur: 117.2 }, 2026, new Date(2026, 9, 5), (amount) => amount);
    const rows = monthlyRows(events, 2026, identity, tax);
    expect(rows[0]).toMatchObject({ income: 2306, tax: 400, net: 1906, taxPlanned: false });
    expect(rows[1]).toMatchObject({ income: 0, net: -400 });
    expect(rows[10]).toMatchObject({ income: 0, planned: 3300, taxPlanned: true, net: 0 });
  });

  it('flags months whose rate is not loaded', () => {
    const rows = monthlyRows(events, 2026, () => null, () => ({ amount: 0, planned: false }));
    expect(rows[0].incomplete).toBe(true);
  });

  it('adds income in a date range, without planned bookings', () => {
    expect(incomeBetween(events, '2026-01-01', '2026-12-31', (amount) => amount * 117)).toEqual({ total: 5306 * 117, incomplete: false });
    expect(yearBefore('2026-10-05')).toBe('2025-10-06');
  });
});

describe('KPO book is the record', () => {
  it('never adds invoices on top of a year that has a KPO book, even when marked paid late', () => {
    const { createEmptyStore, createInvoice, createLineItem } = require('../invoices/model');
    const book = createBook();
    book.entries = [createEntry({ date: '2026-02-12', description: 'Usluge (Wisteria d.o.o.)', services: 2250 })];
    const invoice = { ...createInvoice(createEmptyStore()), status: 'paid', issueDate: '2026-01-31', dueDate: '2026-02-14', paidAt: '2026-10-05' };
    invoice.client = { ...invoice.client, name: 'Wisteria d.o.o.' };
    invoice.items = [createLineItem({ quantity: 1, unitPrice: 2250 })];
    const events = incomeEvents(book, [invoice], [2026], '2026-10-05');
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('kpo');
  });
});
