/** Canonical decimal input, 24 integer and 12 fractional digits; no float conversion. */
const decimal = (value: string) => {
  if (typeof value !== 'string' || !/^-?(0|[1-9]\d{0,23})(\.\d{1,12})?$/.test(value)) throw new Error('Invalid decimal');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  return { coefficient: BigInt(whole + fraction) * (negative ? BigInt(-1) : BigInt(1)), scale: fraction.length };
};
const rounded = (coefficient: bigint, scale: number, outputScale: number): string => {
  const sign = coefficient < BigInt(0) ? BigInt(-1) : BigInt(1);
  const absolute = coefficient * sign;
  if (scale <= outputScale) return (coefficient * BigInt(10) ** BigInt(outputScale - scale)).toString();
  const divisor = BigInt(10) ** BigInt(scale - outputScale);
  const quotient = absolute / divisor;
  const extra = (absolute % divisor) * BigInt(2) >= divisor ? BigInt(1) : BigInt(0);
  return ((quotient + extra) * sign).toString();
};
/** Half away from zero, in minor units. Negative results are not ordinary journal-line amounts. */
export const decimalToMinor = (value: string): string => {
  const parsed = decimal(value);
  return rounded(parsed.coefficient, parsed.scale, 2);
};
export const multiplyToMinor = (quantity: string, price: string): string => {
  const q = decimal(quantity); const p = decimal(price);
  return rounded(q.coefficient * p.coefficient, q.scale + p.scale, 2);
};
