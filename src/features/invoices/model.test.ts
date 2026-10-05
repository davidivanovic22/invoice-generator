import {
  createEmptyStore,
  createInvoice,
  createLineItem,
  displayStatus,
  duplicateInvoice,
  generateRecurring,
  invoiceTotals,
  isDomesticClient,
  isNumberTaken,
  dueTaxMonths,
  nextInvoiceNumber,
  nextRecurringDate,
  paidIncomeEur,
  paidTaxMonths,
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

  it('counts a month once its 15th has passed', () => {
    expect(dueTaxMonths(2026, new Date(2026, 9, 14))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(dueTaxMonths(2026, new Date(2026, 9, 15))).toHaveLength(10);
    expect(dueTaxMonths(2025, today)).toHaveLength(12);
    expect(dueTaxMonths(2027, today)).toEqual([]);
  });

  it('multiplies the monthly tax by the paid months', () => {
    expect(taxSpentEur({ monthly: 400, currency: 'EUR', rsdPerEur: 117.2 }, 2026, today)).toBe(3600);
    expect(taxSpentEur({ monthly: 400, currency: 'EUR', rsdPerEur: 117.2 }, 2025, today)).toBe(4800);
    expect(taxSpentEur({ monthly: 46880, currency: 'RSD', rsdPerEur: 117.2 }, 2026, today)).toBeCloseTo(3600);
    expect(taxSpentEur(undefined, 2026, today)).toBe(0);
  });

  it('uses the ticked months when the user marked them', () => {
    const tax = { monthly: 400, currency: 'EUR' as const, rsdPerEur: 117.2, paidMonths: [1, 2, 3, 10] };
    expect(paidTaxMonths(tax, 2026, today)).toEqual([1, 2, 3, 10]);
    expect(taxSpentEur(tax, 2026, today)).toBe(1600);
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

describe('recurring invoices', () => {
  const base = () => {
    const store = createEmptyStore();
    const source: Invoice = { ...createInvoice(store), number: '2026-008', issueDate: '2026-08-31', serviceDate: '2026-08-31', dueDate: '2026-09-14', billingPeriod: 'avgust 2026.', repeatDay: 31 };
    source.design.language = 'sr';
    source.client.name = 'Wisteria d.o.o.';
    store.invoices = [source];
    return { store, source };
  };

  it('clamps to the end of shorter months and keeps the original day', () => {
    expect(nextRecurringDate('2026-08-31', 31)).toBe('2026-09-30');
    expect(nextRecurringDate('2026-09-30', 31)).toBe('2026-10-31');
    expect(nextRecurringDate('2026-01-31', 31)).toBe('2026-02-28');
  });

  it('creates missed months as drafts and moves the series to the newest copy', () => {
    const { store, source } = base();
    const { store: next, created } = generateRecurring(store, '2026-10-31');
    expect(created.map((invoice) => [invoice.number, invoice.issueDate, invoice.dueDate, invoice.billingPeriod])).toEqual([
      ['2026-009', '2026-09-30', '2026-10-14', 'septembar 2026.'],
      ['2026-010', '2026-10-31', '2026-11-14', 'oktobar 2026.']
    ]);
    expect(created.every((invoice) => invoice.status === 'draft' && invoice.client.name === 'Wisteria d.o.o.')).toBe(true);
    expect(next.invoices.find((invoice) => invoice.id === source.id)?.repeatDay).toBeNull();
    expect(next.invoices.filter((invoice) => invoice.repeatDay)).toHaveLength(1);
    expect(generateRecurring(next, '2026-10-31').created).toHaveLength(0);
  });

  it('does nothing before the next date', () => {
    expect(generateRecurring(base().store, '2026-09-29').created).toHaveLength(0);
  });
});

describe('isDomesticClient', () => {
  it('spots clients in Serbia', () => {
    const party = (cityCountry: string) => ({ ...createEmptyStore().profile.party, cityCountry });
    expect(isDomesticClient(party('18210 Prćilovica, Srbija'))).toBe(true);
    expect(isDomesticClient(party('Belgrade, Serbia'))).toBe(true);
    expect(isDomesticClient(party('Zagreb, Croatia'))).toBe(false);
    expect(isDomesticClient(party(''))).toBe(false);
  });
});

describe('nextInvoiceNumber style', () => {
  it('keeps two-digit numbering when the user uses it', () => {
    const invoices = ['2026-01', '2026-12'].map((number) => ({ ...createInvoice(createEmptyStore()), number }));
    expect(nextInvoiceNumber(invoices, '', '2026-10-04')).toBe('2026-13');
  });
});
