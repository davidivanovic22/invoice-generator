import {
  createEmptyStore,
  createInvoice,
  createLineItem,
  displayStatus,
  duplicateInvoice,
  invoiceTotals,
  isNumberTaken,
  monthsSoFar,
  nextInvoiceNumber,
  paidIncomeEur,
  taxSpentEur,
  type Invoice
} from './model';

const withNumber = (number: string): Invoice => ({ ...createInvoice(createEmptyStore()), number });

describe('nextInvoiceNumber', () => {
  it('starts at 001 for a new year', () => {
    expect(nextInvoiceNumber([], '', '2026-03-01')).toBe('2026-001');
  });

  it('continues after the highest number for that year and prefix', () => {
    const invoices = [withNumber('2026-001'), withNumber('2026-007'), withNumber('2025-120'), withNumber('INV-2026-050')];
    expect(nextInvoiceNumber(invoices, '', '2026-10-04')).toBe('2026-008');
    expect(nextInvoiceNumber(invoices, 'INV-', '2026-10-04')).toBe('INV-2026-051');
    expect(nextInvoiceNumber(invoices, '', '2027-01-02')).toBe('2027-001');
  });

  it('ignores numbers that do not follow the pattern', () => {
    expect(nextInvoiceNumber([withNumber('InvoiceDavidIvanovic-2026-09'), withNumber('abc')], '', '2026-10-04')).toBe('2026-001');
  });

  it('keeps a wider counter if one is already in use', () => {
    expect(nextInvoiceNumber([withNumber('2026-0041')], '', '2026-10-04')).toBe('2026-0042');
  });
});

describe('isNumberTaken', () => {
  it('detects duplicates but not the invoice itself', () => {
    const a = withNumber('2026-001');
    const b = withNumber('2026-002');
    expect(isNumberTaken([a, b], '2026-001', b.id)).toBe(true);
    expect(isNumberTaken([a, b], '2026-001', a.id)).toBe(false);
  });
});

describe('createInvoice', () => {
  it('applies the business profile defaults', () => {
    const store = createEmptyStore();
    store.profile.party.name = 'Studio Sever';
    store.profile.bank.iban = 'RS35';
    store.profile.defaults = { ...store.profile.defaults, currency: 'RSD', vatPercent: 20, paymentDays: 30, template: 'classic' };
    const invoice = createInvoice(store);
    expect(invoice.issuer.name).toBe('Studio Sever');
    expect(invoice.bank.iban).toBe('RS35');
    expect(invoice.currency).toBe('RSD');
    expect(invoice.vatPercent).toBe(20);
    expect(invoice.design.template).toBe('classic');
    const days = (new Date(invoice.dueDate).getTime() - new Date(invoice.issueDate).getTime()) / 86_400_000;
    expect(days).toBe(30);
  });
});

describe('duplicateInvoice', () => {
  it('copies client and items into a new draft with the next number', () => {
    const store = createEmptyStore();
    const source = { ...createInvoice(store), number: `${new Date().getFullYear()}-004`, status: 'paid' as const };
    source.client.name = 'Northwind';
    source.items = [createLineItem({ title: 'Design', quantity: 2, unitPrice: 50 })];
    store.invoices = [source];
    const copy = duplicateInvoice(store, source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.status).toBe('draft');
    expect(copy.number).toBe(`${new Date().getFullYear()}-005`);
    expect(copy.client.name).toBe('Northwind');
    expect(copy.items[0].id).not.toBe(source.items[0].id);
    expect(invoiceTotals(copy).total).toBe(100);
  });
});

describe('displayStatus', () => {
  it('marks sent invoices past their due date as overdue', () => {
    const invoice = { ...withNumber('1'), status: 'sent' as const, dueDate: '2026-10-01' };
    expect(displayStatus(invoice, '2026-10-01')).toBe('sent');
    expect(displayStatus(invoice, '2026-10-02')).toBe('overdue');
    expect(displayStatus({ ...invoice, status: 'paid' }, '2026-12-01')).toBe('paid');
  });
});

describe('yearly tax', () => {
  const today = new Date(2026, 9, 5);

  it('multiplies the monthly tax by the months so far', () => {
    expect(taxSpentEur({ monthly: 400, currency: 'EUR', rsdPerEur: 117.2 }, 2026, today)).toBe(4000);
    expect(taxSpentEur({ monthly: 400, currency: 'EUR', rsdPerEur: 117.2 }, 2025, today)).toBe(4800);
    expect(taxSpentEur({ monthly: 46880, currency: 'RSD', rsdPerEur: 117.2 }, 2026, today)).toBeCloseTo(4000);
    expect(taxSpentEur(undefined, 2026, today)).toBe(0);
    expect(monthsSoFar(2027, today)).toBe(0);
  });

  it('sums paid income in EUR, converting RSD and skipping other currencies', () => {
    const paid = (date: string, currency: string, price: number): Invoice => ({
      ...withNumber('x'),
      status: 'paid',
      issueDate: date,
      currency,
      items: [createLineItem({ quantity: 1, unitPrice: price })]
    });
    const result = paidIncomeEur(
      [paid('2026-01-31', 'EUR', 3300), paid('2026-02-28', 'RSD', 117200), paid('2026-03-31', 'USD', 500), paid('2025-12-31', 'EUR', 999), { ...paid('2026-04-30', 'EUR', 700), status: 'sent' }],
      2026,
      117.2
    );
    expect(result.total).toBeCloseTo(4300);
    expect(result.skipped).toBe(1);
  });
});
