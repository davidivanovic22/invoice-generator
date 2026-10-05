import { uiLocale } from '../i18n';

/**
 * Exact invoice arithmetic.
 *
 * Amounts are carried as integers in the currency's minor unit (cents, para)
 * so totals never drift from the line items printed above them. Policy:
 * each line is rounded half-away-from-zero to the minor unit, the subtotal is
 * the sum of the rounded lines, and VAT is computed once on that subtotal.
 */

const INPUT_DECIMALS = 4;

/** Splits a decimal number into an exact integer and its power-of-ten scale. */
const toScaled = (value: number): { int: number; scale: number } => {
  if (!Number.isFinite(value)) return { int: 0, scale: 0 };
  const text = value.toFixed(INPUT_DECIMALS).replace(/\.?0+$/, '');
  const [whole, fraction = ''] = text.split('.');
  return { int: Number(whole + fraction), scale: fraction.length };
};

/** Divides an integer by 10^places, rounding half away from zero. */
const roundShift = (int: number, places: number): number => {
  if (places <= 0) return int * 10 ** -places;
  const divisor = 10 ** places;
  const sign = int < 0 ? -1 : 1;
  const abs = Math.abs(int);
  const quotient = Math.floor(abs / divisor);
  const remainder = abs - quotient * divisor;
  return sign * (remainder * 2 >= divisor ? quotient + 1 : quotient);
};

// ISO 4217 minor units where CLDR's display default differs (CLDR shows RSD without para).
const ISO_DECIMALS: Record<string, number> = { RSD: 2 };

const fractionDigitsCache = new Map<string, number>();

export const currencyDecimals = (currency: string): number => {
  const cached = fractionDigitsCache.get(currency);
  if (cached !== undefined) return cached;
  let digits = ISO_DECIMALS[currency];
  if (digits === undefined) {
    try {
      digits =
        new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
          .maximumFractionDigits ?? 2;
    } catch {
      digits = 2; // Unknown currency code.
    }
  }
  fractionDigitsCache.set(currency, digits);
  return digits;
};

/** Converts a major-unit amount (e.g. 12.5 EUR) to minor units (1250). */
export const toMinor = (amount: number, currency: string): number => {
  const { int, scale } = toScaled(amount);
  return roundShift(int, scale - currencyDecimals(currency));
};

export const fromMinor = (minor: number, currency: string): number =>
  minor / 10 ** currencyDecimals(currency);

/** quantity × unit price, rounded to the currency's minor unit. */
export const lineTotalMinor = (quantity: number, unitPrice: number, currency: string): number => {
  const q = toScaled(quantity);
  const p = toScaled(unitPrice);
  const product = q.int * p.int;
  const places = q.scale + p.scale - currencyDecimals(currency);
  if (Number.isSafeInteger(product)) return roundShift(product, places);
  // Astronomically large inputs: precision past 2^53 is meaningless on an invoice anyway.
  return Math.round(quantity * unitPrice * 10 ** currencyDecimals(currency));
};

/** percent of an amount already in minor units, e.g. 20% VAT. */
export const percentOfMinor = (minor: number, percent: number): number => {
  const p = toScaled(percent);
  const product = minor * p.int;
  if (Number.isSafeInteger(product)) return roundShift(product, p.scale + 2);
  return Math.round((minor * percent) / 100);
};

export type MoneyLine = { quantity: number; unitPrice: number };

export type MoneyTotals = {
  lines: number[];
  subtotal: number;
  tax: number;
  total: number;
};

/** All values in minor units. */
export const computeTotals = (
  lines: MoneyLine[],
  taxPercent: number,
  currency: string
): MoneyTotals => {
  const lineTotals = lines.map((line) => lineTotalMinor(line.quantity, line.unitPrice, currency));
  const subtotal = lineTotals.reduce((sum, value) => sum + value, 0);
  const tax = percentOfMinor(subtotal, taxPercent);
  return { lines: lineTotals, subtotal, tax, total: subtotal + tax };
};

const formatterCache = new Map<string, Intl.NumberFormat>();

const getFormatter = (currency: string, locale: string) => {
  const key = `${locale}|${currency}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    try {
      const digits = currencyDecimals(currency);
      formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      });
    } catch {
      formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
    formatterCache.set(key, formatter);
  }
  return formatter;
};

/** Without a locale, amounts follow the app's language (documents always pass their own). */
export const formatMinor = (minor: number, currency: string, locale = uiLocale()): string =>
  getFormatter(currency, locale).format(fromMinor(minor, currency));

/** Formats a major-unit amount after rounding it with the invoice policy. */
export const formatAmount = (amount: number, currency: string, locale = uiLocale()): string =>
  formatMinor(toMinor(amount, currency), currency, locale);
