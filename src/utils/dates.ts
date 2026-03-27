export const todayIso = (): string => {
  return new Date().toISOString().slice(0, 10);
};

export const addDaysIso = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const currentBillingPeriod = (): string => {
  return new Date().toLocaleString('en-US', {
    month: 'long',
    year: 'numeric'
  });
};