export const formatMoney = (value: number, currency = 'EUR'): string => {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-IE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
};

export const toNumber = (value: string | number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};