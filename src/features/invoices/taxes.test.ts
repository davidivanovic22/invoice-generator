import { convert } from '../../lib/fx';
import { createEmptyStore, createInvoice, createLineItem, type Invoice } from './model';
import { createTaxYear, invoiceNet, monthlyTaxEur, monthsElapsed, yearSummary } from './taxes';

const store = createEmptyStore();
const invoice = (overrides: Partial<Invoice>): Invoice => ({
  ...createInvoice(store),
  status: 'sent',
  items: [createLineItem({ quantity: 1, unitPrice: 1000 })],
  ...overrides
});

describe('convert', () => {
  it('converts between EUR and RSD and refuses other pairs', () => {
    expect(convert(11720, 'RSD', 'EUR', 117.2)).toBe(100);
    expect(convert(100, 'EUR', 'RSD', 117.2)).toBeCloseTo(11720);
    expect(convert(5, 'USD', 'EUR', 117.2)).toBeNull();
  });
});

describe('tax years', () => {
  const profile = {
    ...store.profile,
    taxes: [createTaxYear({ year: 2026, monthlyAmount: 35160, currency: 'RSD', rsdPerEur: 117.2 }), createTaxYear({ year: 2025, monthlyAmount: 280, currency: 'EUR' })]
  };

  it('computes the monthly tax in EUR for either currency', () => {
    expect(monthlyTaxEur(profile.taxes[0])).toBeCloseTo(300);
    expect(monthlyTaxEur(profile.taxes[1])).toBe(280);
  });

  it('subtracts the month\'s tax from an invoice, using the year it was issued', () => {
    const net = invoiceNet(invoice({ issueDate: '2026-03-31', currency: 'EUR' }), profile);
    expect(net).toMatchObject({ year: 2026, totalEur: 1000 });
    expect(net?.netEur).toBeCloseTo(700);
    expect(invoiceNet(invoice({ issueDate: '2025-12-01', currency: 'EUR' }), profile)?.taxEur).toBe(280);
    expect(invoiceNet(invoice({ issueDate: '2024-05-01', currency: 'EUR' }), profile)).toBeNull();
  });

  it('converts RSD invoices with the rate saved for the year', () => {
    const net = invoiceNet(invoice({ issueDate: '2026-02-01', currency: 'RSD', items: [createLineItem({ quantity: 1, unitPrice: 117200 })] }), profile);
    expect(net?.totalEur).toBeCloseTo(1000);
  });

  it('summarises a year: sent and paid income, tax for the months so far', () => {
    const invoices = [
      invoice({ issueDate: '2026-01-31', currency: 'EUR' }),
      invoice({ issueDate: '2026-02-28', currency: 'EUR', status: 'paid' }),
      invoice({ issueDate: '2026-03-15', currency: 'EUR', status: 'draft' }),
      invoice({ issueDate: '2026-03-31', currency: 'USD' })
    ];
    const summary = yearSummary(invoices, profile, 2026, new Date(2026, 2, 10));
    expect(summary).toMatchObject({ months: 3, incomeEur: 2000, skipped: 1, hasTax: true });
    expect(summary.taxEur).toBeCloseTo(900);
    expect(summary.netEur).toBeCloseTo(1100);
  });

  it('counts all months for past years and none for future years', () => {
    const today = new Date(2026, 9, 5);
    expect(monthsElapsed(2025, today)).toBe(12);
    expect(monthsElapsed(2026, today)).toBe(10);
    expect(monthsElapsed(2027, today)).toBe(0);
  });
});
