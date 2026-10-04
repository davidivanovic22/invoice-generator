import {
  computeTotals,
  currencyDecimals,
  formatMinor,
  lineTotalMinor,
  percentOfMinor,
  toMinor
} from './money';

describe('toMinor', () => {
  it('rounds half away from zero despite binary float representation', () => {
    expect(toMinor(1.005, 'EUR')).toBe(101);
    expect(toMinor(2.675, 'EUR')).toBe(268);
    expect(toMinor(-1.005, 'EUR')).toBe(-101);
    expect(toMinor(0.1 + 0.2, 'EUR')).toBe(30);
  });

  it('respects currencies without minor units', () => {
    expect(currencyDecimals('JPY')).toBe(0);
    expect(toMinor(1234.5, 'JPY')).toBe(1235);
  });

  it('treats non-finite input as zero', () => {
    expect(toMinor(NaN, 'EUR')).toBe(0);
    expect(toMinor(Infinity, 'EUR')).toBe(0);
  });
});

describe('lineTotalMinor', () => {
  it('multiplies exactly before rounding', () => {
    // 0.145 * 3 is 0.43499999999999994 in floats; the exact value rounds up.
    expect(lineTotalMinor(3, 0.145, 'EUR')).toBe(44);
    expect(lineTotalMinor(0.1, 3 * 20, 'EUR')).toBe(600);
    expect(lineTotalMinor(165, 20, 'EUR')).toBe(330000);
    expect(lineTotalMinor(7.5, 33.33, 'EUR')).toBe(24998);
  });

  it('handles zero and negative quantities (credit lines)', () => {
    expect(lineTotalMinor(0, 99, 'EUR')).toBe(0);
    expect(lineTotalMinor(-2, 10.005, 'EUR')).toBe(-2001);
  });
});

describe('percentOfMinor', () => {
  it('computes VAT on minor units with fractional rates', () => {
    expect(percentOfMinor(10000, 20)).toBe(2000);
    expect(percentOfMinor(3003, 20)).toBe(601);
    expect(percentOfMinor(10001, 8.5)).toBe(850);
    expect(percentOfMinor(12345, 0)).toBe(0);
  });
});

describe('computeTotals', () => {
  it('makes the subtotal equal the sum of the printed lines', () => {
    const totals = computeTotals(
      [
        { quantity: 1, unitPrice: 10.005 },
        { quantity: 1, unitPrice: 10.005 },
        { quantity: 1, unitPrice: 10.005 }
      ],
      0,
      'EUR'
    );
    expect(totals.lines).toEqual([1001, 1001, 1001]);
    expect(totals.subtotal).toBe(3003);
    expect(totals.total).toBe(3003);
  });

  it('adds VAT once on the rounded subtotal', () => {
    const totals = computeTotals(
      [
        { quantity: 2.5, unitPrice: 40 },
        { quantity: 1, unitPrice: 0.333 }
      ],
      20,
      'RSD'
    );
    expect(totals.subtotal).toBe(10033);
    expect(totals.tax).toBe(2007);
    expect(totals.total).toBe(12040);
  });

  it('handles an empty invoice and many lines', () => {
    expect(computeTotals([], 20, 'EUR')).toEqual({ lines: [], subtotal: 0, tax: 0, total: 0 });
    const many = Array.from({ length: 1000 }, () => ({ quantity: 0.1, unitPrice: 0.1 }));
    expect(computeTotals(many, 0, 'EUR').subtotal).toBe(1000);
  });
});

describe('formatMinor', () => {
  it('formats per currency and locale', () => {
    expect(formatMinor(123456, 'EUR', 'en-US')).toBe('€1,234.56');
    expect(formatMinor(123456, 'RSD', 'sr-Latn-RS').replace(/\s/g, ' ')).toMatch(/1\.234,56/);
  });
});
