export const formatMoney = (value: number, currency = 'EUR'): string => {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
};

export const formatPlainNumber = (value: number): string => {
  return new Intl.NumberFormat('en-IE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
};

export const toInputNumber = (value: string | number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const todayIso = (): string => {
  return new Date().toISOString().slice(0, 10);
};

export const addDaysIso = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const createInvoiceNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const random = `${Math.floor(Math.random() * 900) + 100}`;
  return `${year}-${month}-${random}`;
};