import { createEmptyStore, createInvoice, createLineItem, type Invoice } from '../invoices/model';
import { parseKpoRows, type Cell } from './importKpo';
import { bookYear, createBook, createEntry, entryFromInvoice, findEntryForInvoice, parseAmount, parseDate, splitDescriptionDate, yearTotals } from './model';

const line = (number: number | null, description: string, services: number): Cell[] => [number, description, 0, services, services];

/** The layout of a typical hand-made KPO workbook. */
const sheet: Cell[][] = [
  [null, null, null, null, 'KPO'],
  ['PIB:', null],
  ['Obveznik:', 'David Ivanović'],
  [null, '(Ime I prezime poreskog obveznika)'],
  ['Firma-radnje:', 'David Ivanović PR računarsko programiranje'],
  ['Sedište:', null],
  [null, 'Dimitrija Tucovića 22, Prćilovica'],
  ['Šifra poreskog obveznika:', null],
  ['Šifra delatnosti:', '6201 – Računarsko programiranje'],
  [],
  ['KNJIGA O OSTVARENOM PROMETU PAUŠALNO OPOREZOVANIH OBVEZNIKA'],
  ['Redni broj', 'Datum I opis knjiženja', 'PRIHOD OD DELATNOSTI', null, 'SVEGA PRIHODI OD DELATNOSTI (3+4)'],
  [null, null, 'od prodaje proizvoda', 'od izvršenih usluga', null],
  [1, 2, 3, 4, 5],
  line(1, 'Usluge računarskog programiranja (Wisteria d.o.o.) 15.01.2026.', 2206),
  line(2, 'Usluge računarskog programiranja (Wisteria d.o.o.) 12.02.2026.', 2250),
  line(9, 'Usluge računarskog programiranja (Wisteria d.o.o.) 14.09.2026.', 1650),
  line(null, 'Usluge računarskog programiranja (Wisteria d.o.o.) 14.10.2026.', 3300),
  [null, 'Ukupno', 0, 9406, 9406]
];

describe('parseKpoRows', () => {
  const parsed = parseKpoRows(sheet)!;

  it('reads the header block, including values on the next row', () => {
    expect(parsed.header).toEqual({
      taxpayer: 'David Ivanović',
      business: 'David Ivanović PR računarsko programiranje',
      seat: 'Dimitrija Tucovića 22, Prćilovica',
      activity: '6201 – Računarsko programiranje'
    });
  });

  it('reads every booking with its date taken from the description', () => {
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows[0]).toEqual({
      date: '2026-01-15',
      description: 'Usluge računarskog programiranja (Wisteria d.o.o.)',
      products: 0,
      services: 2206,
      number: 1
    });
    expect(parsed.rows[3]).toMatchObject({ date: '2026-10-14', number: null, services: 3300 });
  });

  it('works with only a total column and Serbian number formats', () => {
    const rows = parseKpoRows([
      ['R.br.', 'Datum', 'Opis knjiženja', 'Ukupno'],
      [1, '03.02.2025', 'Faktura 1', '1.234.567,89']
    ]);
    expect(rows?.rows[0]).toMatchObject({ date: '2025-02-03', services: 1234567.89, products: 0 });
  });
});

describe('parsing helpers', () => {
  it('parses amounts', () => {
    expect(parseAmount('2.206')).toBe(2206);
    expect(parseAmount('2206,50')).toBe(2206.5);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('12.50')).toBe(12.5);
    expect(parseAmount('€ 3 300,00')).toBe(3300);
    expect(parseAmount('')).toBeNull();
  });

  it('parses dates', () => {
    expect(parseDate('15.01.2026.')).toBe('2026-01-15');
    expect(parseDate('5.1.2026')).toBe('2026-01-05');
    expect(parseDate(46037)).toBe('2026-01-15');
    expect(parseDate('nope')).toBeNull();
  });

  it('splits the date off the description', () => {
    expect(splitDescriptionDate('Usluge (X) 15.01.2026.')).toEqual({ description: 'Usluge (X)', date: '2026-01-15' });
    expect(splitDescriptionDate('Bez datuma')).toEqual({ description: 'Bez datuma', date: null });
  });
});

describe('book', () => {
  const invoice = (overrides: Partial<Invoice>): Invoice => {
    const value = { ...createInvoice(createEmptyStore()), ...overrides };
    value.client = { ...value.client, name: 'Wisteria d.o.o.' };
    value.items = [createLineItem({ quantity: 1, unitPrice: 3300 })];
    return value;
  };

  it('numbers past entries and leaves planned ones unnumbered', () => {
    const book = createBook();
    book.entries = [
      createEntry({ date: '2026-03-10', services: 3000 }),
      createEntry({ date: '2026-01-15', services: 2206 }),
      createEntry({ date: '2026-11-14', services: 3300 })
    ];
    const rows = bookYear(book, 2026, '2026-10-05');
    expect(rows.map((row) => row.number)).toEqual([1, 2, null]);
    expect(yearTotals(rows).total).toBe(5206);
    expect(yearTotals(rows, true).total).toBe(8506);
  });

  it('creates an entry from an invoice and recognises an imported one', () => {
    const book = createBook();
    const paid = invoice({ status: 'paid', issueDate: '2026-09-30', paidAt: '2026-10-14' });
    const entry = entryFromInvoice(paid, book, 1)!;
    expect(entry).toMatchObject({ date: '2026-10-14', description: 'Usluge računarskog programiranja (Wisteria d.o.o.)', services: 3300, invoiceId: paid.id });
    expect(entryFromInvoice(paid, book, null)).toBeNull();

    const imported = createEntry({ date: '2026-10-14', description: 'Usluge računarskog programiranja (Wisteria d.o.o.)', services: 3300, source: 'import' });
    expect(findEntryForInvoice(paid, [imported], 3300, 'paid')).toBe(imported);
    expect(findEntryForInvoice(paid, [imported], 2850, 'paid')).toBeNull();
  });
});
