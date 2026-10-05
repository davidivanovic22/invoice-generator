import { matchPayments, parseStatement } from './bankImport';
import { createEmptyStore, createInvoice, createLineItem, type Invoice } from './model';

const invoice = (number: string, issueDate: string, price: number, overrides: Partial<Invoice> = {}): Invoice => {
  const value = { ...createInvoice(createEmptyStore()), number, issueDate, dueDate: issueDate, status: 'sent' as const, ...overrides };
  value.client = { ...value.client, name: 'Wisteria d.o.o.' };
  value.items = [createLineItem({ quantity: 1, unitPrice: price })];
  return value;
};

describe('parseStatement', () => {
  it('reads inflows from a statement with separate in/out columns', () => {
    const payments = parseStatement([
      ['Izvod br. 12', null, null, null],
      ['Datum', 'Opis', 'Isplata', 'Uplata'],
      ['14.09.2026.', 'WISTERIA D.O.O. INV 2026-08', null, '1.650,00'],
      ['15.09.2026.', 'Provizija banke', '350,00', null],
      ['Ukupno', null, '350,00', '1.650,00']
    ]);
    expect(payments).toEqual([{ date: '2026-09-14', amount: 1650, text: 'WISTERIA D.O.O. INV 2026-08' }]);
  });

  it('reads a single signed amount column and ignores money going out', () => {
    const payments = parseStatement([
      ['Date', 'Payer', 'Details', 'Amount'],
      ['2026-10-14', 'Wisteria d.o.o.', 'Invoice 2026-09', 3285],
      ['2026-10-15', 'Telekom', 'Bill', -45.5]
    ]);
    expect(payments).toEqual([{ date: '2026-10-14', amount: 3285, text: 'Wisteria d.o.o. · Invoice 2026-09' }]);
  });

  it('returns null for a file that is not a statement', () => {
    expect(parseStatement([['Name', 'City'], ['A', 'B']])).toBeNull();
  });
});

describe('matchPayments', () => {
  it('pairs each payment with one invoice, preferring the named invoice', () => {
    const invoices = [invoice('2026-03', '2026-04-01', 3300), invoice('2026-04', '2026-05-01', 3300)];
    const { matches, unmatched } = matchPayments(
      [
        { date: '2026-05-12', amount: 3300, text: 'Wisteria 2026-04' },
        { date: '2026-04-15', amount: 3300, text: 'Wisteria' },
        { date: '2026-04-20', amount: 99, text: 'Kamata' }
      ],
      invoices
    );
    expect(matches.map((match) => [match.invoice.number, match.payment.date, match.kind])).toEqual([
      ['2026-03', '2026-04-15', 'exact'],
      ['2026-04', '2026-05-12', 'exact']
    ]);
    expect(unmatched).toHaveLength(1);
  });

  it('accepts a slightly lower amount as bank charges, and fixes a wrong payment date', () => {
    const paidLate = invoice('2026-09', '2026-10-01', 3300, { status: 'paid', paidAt: '2026-10-04' });
    const { matches } = matchPayments([{ date: '2026-10-14', amount: 3285, text: 'WISTERIA' }], [paidLate]);
    expect(matches[0]).toMatchObject({ kind: 'fees', fixesDate: true });
    expect(matchPayments([{ date: '2026-10-14', amount: 2000, text: 'WISTERIA' }], [paidLate]).matches).toHaveLength(0);
  });

  it('leaves alone invoices already paid on that day', () => {
    const paid = invoice('2026-09', '2026-10-01', 3300, { status: 'paid', paidAt: '2026-10-14' });
    const result = matchPayments([{ date: '2026-10-14', amount: 3300, text: '' }], [paid]);
    expect(result.matches).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
  });
});
