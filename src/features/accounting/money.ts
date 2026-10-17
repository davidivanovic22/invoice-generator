import { minorUnits } from '../../domain/accounting/journal';

/** Input is a decimal string; conversion never passes through a JS number. */
export const parseRsd = (input: string) => {
  const value = input.trim().replace(',', '.');
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) throw new Error('invalid_amount');
  const [whole, fraction = ''] = value.split('.');
  return minorUnits((BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0'))).toString());
};
export const formatRsd = (value: string) => {
  const amount = BigInt(value);
  const negative = amount < BigInt(0);
  const magnitude = negative ? -amount : amount;
  return `${negative ? '-' : ''}${magnitude / BigInt(100)}.${(magnitude % BigInt(100)).toString().padStart(2,'0')}`;
};
