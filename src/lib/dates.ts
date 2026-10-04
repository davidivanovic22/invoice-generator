const pad = (value: number) => String(value).padStart(2, '0');

/** YYYY-MM-DD in the user's local time zone (toISOString would give the UTC date). */
export const toIsoDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayIso = (): string => toIsoDate(new Date());

/** Parses YYYY-MM-DD as a local date (new Date('YYYY-MM-DD') would parse it as UTC). */
export const parseIsoDate = (iso: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const addDaysIso = (iso: string, days: number): string => {
  const date = parseIsoDate(iso) ?? new Date();
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

export const daysBetween = (fromIso: string, toIso: string): number => {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
};

export const formatDate = (iso: string, locale = 'en-GB'): string => {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

/** Numeric date as used on Serbian documents: 04.10.2026. */
export const formatDateNumeric = (iso: string): string => {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}.`;
};

export const monthLabel = (iso: string, locale = 'en-US'): string => {
  const date = parseIsoDate(iso) ?? new Date();
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
};
