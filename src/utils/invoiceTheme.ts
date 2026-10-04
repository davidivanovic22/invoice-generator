import type { InvoiceEditorSettings } from '../types/invoice';
import motifCatalog from '../data/invoiceMotifs.json';

export type InvoiceTemplateMode = 'manual' | 'auto-season' | 'auto-month';
type InvoiceMonthKey = keyof typeof motifCatalog;
export type InvoiceTemplateKey = 'winter' | 'spring' | 'summer' | 'autumn' | InvoiceMonthKey;

export type InvoiceResolvedTheme = {
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
  tableRowBackground: string;
  totalCardBackground: string;
  noteBackground: string;
  logoRing: string;
  /** Standalone A4 vector composition; shared by editor, print and PDF. */
  backgroundImage: string;
  backgroundImageIndex: number;
  backgroundImages: string[];
  /** Narrative names for the five visually distinct compositions. */
  backgroundImageLabels: string[];
  backgroundPosition: string;
};

type ThemeSeed = { label: string; month: InvoiceMonthKey };
const INK = '#1c2333';
const MUTED = '#5b6472';
const rgba = (hex: string, alpha: number) => {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

const buildTheme = (key: InvoiceTemplateKey, seed: ThemeSeed): InvoiceResolvedTheme => {
  const artwork = motifCatalog[seed.month];
  const [accent, light, deep, , gold] = artwork.palette;
  const images = artwork.names.map((_, index) =>
    `/invoice-motifs/${String(index + 1).padStart(2, '0')}-${seed.month}.svg`
  );
  return {
    key,
    label: seed.label,
    accentColor: accent,
    background: '#ffffff',
    surface: '#ffffff',
    surfaceAlt: 'rgba(255,255,255,0.96)',
    borderColor: rgba(deep, 0.2),
    textPrimary: INK,
    textMuted: MUTED,
    headerGradient: `linear-gradient(135deg, ${rgba(light, 0.4)}, #ffffff)`,
    tableHeaderBackground: rgba(light, 0.6),
    tableRowBackground: 'rgba(255,255,255,0.96)',
    totalCardBackground: rgba(light, 0.45),
    noteBackground: 'rgba(255,255,255,0.97)',
    logoRing: rgba(gold, 0.4),
    backgroundImage: images[0],
    backgroundImageIndex: 0,
    backgroundImages: images,
    backgroundImageLabels: artwork.names,
    backgroundPosition: 'center center'
  };
};

const THEME_SEEDS: Record<InvoiceTemplateKey, ThemeSeed> = {
  winter: { label: 'Winter', month: 'january' },
  spring: { label: 'Spring', month: 'april' },
  summer: { label: 'Summer', month: 'july' },
  autumn: { label: 'Autumn', month: 'october' },
  january: { label: 'January', month: 'january' },
  february: { label: 'February', month: 'february' },
  march: { label: 'March', month: 'march' },
  april: { label: 'April', month: 'april' },
  may: { label: 'May', month: 'may' },
  june: { label: 'June', month: 'june' },
  july: { label: 'July', month: 'july' },
  august: { label: 'August', month: 'august' },
  september: { label: 'September', month: 'september' },
  october: { label: 'October', month: 'october' },
  november: { label: 'November', month: 'november' },
  december: { label: 'December', month: 'december' }
};

export const INVOICE_THEMES: Record<InvoiceTemplateKey, InvoiceResolvedTheme> = Object.fromEntries(
  (Object.keys(THEME_SEEDS) as InvoiceTemplateKey[]).map((key) => [key, buildTheme(key, THEME_SEEDS[key])])
) as Record<InvoiceTemplateKey, InvoiceResolvedTheme>;

const getSeasonTemplateKeyByMonth = (month: number): InvoiceTemplateKey => {
  switch (month) {
    case 12:
    case 1:
    case 2:
      return 'winter';
    case 3:
    case 4:
    case 5:
      return 'spring';
    case 6:
    case 7:
    case 8:
      return 'summer';
    default:
      return 'autumn';
  }
};

const getMonthTemplateKey = (month: number): InvoiceTemplateKey => {
  const keys: InvoiceTemplateKey[] = [
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

  return keys[Math.max(0, Math.min(11, month - 1))];
};

type InvoiceMonthDay = { month: number; day: number };

const parseInvoiceMonthDay = (value?: string | null): InvoiceMonthDay | null => {
  if (!value) return null;

  const normalized = value.trim();

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return Number.isFinite(month) ? { month, day: Number.isFinite(day) ? day : 1 } : null;
  }

  const slashMatch = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);

    if (second >= 1 && second <= 12) return { month: second, day: first };
    if (first >= 1 && first <= 12) return { month: first, day: second };
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return { month: parsed.getMonth() + 1, day: parsed.getDate() };
  }

  return null;
};

const parseInvoiceMonth = (value?: string | null): number | null => {
  const monthDay = parseInvoiceMonthDay(value);
  return monthDay ? monthDay.month : null;
};

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12
};

// The billing period is free text (e.g. "April 2026") that states outright
// which month the invoice is for — trust it over the issue date, since an
// invoice is often issued a few days into the following month for the
// previous month's work.
const parseMonthFromBillingPeriod = (value?: string | null): number | null => {
  if (!value) return null;

  const normalized = value.toLowerCase();

  for (const [name, month] of Object.entries(MONTH_NAME_TO_NUMBER)) {
    if (normalized.includes(name)) return month;
  }

  return null;
};

// Picks up a 4-digit year from either "September 2026" (billing period) or
// an ISO date string — used only to rotate between watermark variants when
// a month has more than one, never to pick the theme itself (the theme is
// month-only, per spec: the YEAR must not affect which month's theme shows).
const parseYear = (value?: string | null): number | null => {
  if (!value) return null;
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
};

// Deterministic, not random: the same invoice (same year) always renders
// the same variant, so re-opening or re-exporting an old invoice never
// changes its look. Different years cycle through whatever variants exist.
const pickVariantIndex = (year: number, variantCount: number): number => {
  if (variantCount <= 1) return 0;
  return ((year % variantCount) + variantCount) % variantCount;
};

export const resolveInvoiceTheme = (
  settings: InvoiceEditorSettings & {
    templateMode?: InvoiceTemplateMode;
    templateKey?: InvoiceTemplateKey;
    useTemplateAccentColor?: boolean;
    templateVariantIndex?: number;
  },
  issueDate?: string,
  billingPeriod?: string
): InvoiceResolvedTheme => {
  const month =
    parseMonthFromBillingPeriod(billingPeriod) ??
    parseInvoiceMonth(issueDate) ??
    new Date().getMonth() + 1;

  const year =
    parseYear(billingPeriod) ??
    parseYear(issueDate) ??
    new Date().getFullYear();

  let key: InvoiceTemplateKey;

  switch (settings.templateMode) {
    case 'auto-month':
      key = getMonthTemplateKey(month);
      break;
    case 'auto-season':
      key = getSeasonTemplateKeyByMonth(month);
      break;
    default:
      key = settings.templateKey ?? 'winter';
      break;
  }

  const template = INVOICE_THEMES[key] ?? INVOICE_THEMES.winter;

  const manualVariant = settings.templateVariantIndex;
  const variantIndex =
    manualVariant !== undefined &&
    manualVariant >= 0 &&
    manualVariant < template.backgroundImages.length
      ? manualVariant
      : pickVariantIndex(year, template.backgroundImages.length);

  return {
    ...template,
    backgroundImage: template.backgroundImages[variantIndex],
    backgroundImageIndex: variantIndex,
    accentColor:
      settings.useTemplateAccentColor === false
        ? settings.accentColor ?? template.accentColor
        : template.accentColor
  };
};
