export type InvoiceSeasonTemplateKey =
  | 'winter'
  | 'spring'
  | 'summer'
  | 'autumn';

export type InvoiceMonthTemplateKey =
  | 'january'
  | 'february'
  | 'march'
  | 'april'
  | 'may'
  | 'june'
  | 'july'
  | 'august'
  | 'september'
  | 'october'
  | 'november'
  | 'december';

export type InvoiceTemplateKey =
  | InvoiceSeasonTemplateKey
  | InvoiceMonthTemplateKey;

export type InvoiceTemplateMode =
  | 'manual'
  | 'auto-season'
  | 'auto-month';

export type InvoiceResolvedTemplate = {
  key: InvoiceTemplateKey;
  label: string;
  accentColor: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  borderColor: string;
  textPrimary: string;
  textMuted: string;
  headerGradient: string;
  tableHeaderBackground: string;
  totalCardBackground: string;
  noteBackground: string;
  logoRing: string;
};

export const MONTH_TEMPLATE_KEYS: InvoiceMonthTemplateKey[] = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
];

export const SEASON_TEMPLATE_KEYS: InvoiceSeasonTemplateKey[] = [
  'winter',
  'spring',
  'summer',
  'autumn'
];