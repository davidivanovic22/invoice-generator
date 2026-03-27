import type { InvoiceEditorSettings } from '../types/invoice';

export type InvoiceTemplateMode = 'manual' | 'auto-season' | 'auto-month';

export type InvoiceTemplateKey =
  | 'winter'
  | 'spring'
  | 'summer'
  | 'autumn'
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
  totalCardBackground: string;
  noteBackground: string;
  logoRing: string;
};

export const INVOICE_THEMES: Record<InvoiceTemplateKey, InvoiceResolvedTheme> = {
  winter: {
    key: 'winter',
    label: 'Winter',
    accentColor: '#2563eb',
    background: '#f8fbff',
    surface: '#ffffff',
    surfaceAlt: '#eff6ff',
    borderColor: '#dbeafe',
    textPrimary: '#0f172a',
    textMuted: '#64748b',
    headerGradient: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 60%, #dbeafe 100%)',
    tableHeaderBackground: '#eff6ff',
    totalCardBackground: '#f8fbff',
    noteBackground: '#f8fbff',
    logoRing: '#dbeafe'
  },
  spring: {
    key: 'spring',
    label: 'Spring',
    accentColor: '#16a34a',
    background: '#f7fff8',
    surface: '#ffffff',
    surfaceAlt: '#ecfdf3',
    borderColor: '#bbf7d0',
    textPrimary: '#14532d',
    textMuted: '#4b5563',
    headerGradient: 'linear-gradient(135deg, #ecfdf3 0%, #ffffff 55%, #dcfce7 100%)',
    tableHeaderBackground: '#ecfdf3',
    totalCardBackground: '#f0fdf4',
    noteBackground: '#f0fdf4',
    logoRing: '#bbf7d0'
  },
  summer: {
    key: 'summer',
    label: 'Summer',
    accentColor: '#ea580c',
    background: '#fffaf5',
    surface: '#ffffff',
    surfaceAlt: '#fff7ed',
    borderColor: '#fed7aa',
    textPrimary: '#431407',
    textMuted: '#78716c',
    headerGradient: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 55%, #ffedd5 100%)',
    tableHeaderBackground: '#fff7ed',
    totalCardBackground: '#fff7ed',
    noteBackground: '#fff7ed',
    logoRing: '#fdba74'
  },
  autumn: {
    key: 'autumn',
    label: 'Autumn',
    accentColor: '#b45309',
    background: '#fffaf3',
    surface: '#ffffff',
    surfaceAlt: '#fffbeb',
    borderColor: '#fcd34d',
    textPrimary: '#422006',
    textMuted: '#6b7280',
    headerGradient: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 55%, #fef3c7 100%)',
    tableHeaderBackground: '#fffbeb',
    totalCardBackground: '#fffbeb',
    noteBackground: '#fffbeb',
    logoRing: '#fde68a'
  },
  january: {
    key: 'january',
    label: 'January',
    accentColor: '#1d4ed8',
    background: '#f8fbff',
    surface: '#ffffff',
    surfaceAlt: '#eef5ff',
    borderColor: '#cfe2ff',
    textPrimary: '#0f172a',
    textMuted: '#64748b',
    headerGradient: 'linear-gradient(135deg, #eaf3ff 0%, #ffffff 55%, #dbeafe 100%)',
    tableHeaderBackground: '#eef5ff',
    totalCardBackground: '#f3f8ff',
    noteBackground: '#f3f8ff',
    logoRing: '#bfdbfe'
  },
  february: {
    key: 'february',
    label: 'February',
    accentColor: '#db2777',
    background: '#fff8fc',
    surface: '#ffffff',
    surfaceAlt: '#fdf2f8',
    borderColor: '#fbcfe8',
    textPrimary: '#4a044e',
    textMuted: '#6b7280',
    headerGradient: 'linear-gradient(135deg, #fdf2f8 0%, #ffffff 55%, #fce7f3 100%)',
    tableHeaderBackground: '#fdf2f8',
    totalCardBackground: '#fff1f7',
    noteBackground: '#fff1f7',
    logoRing: '#f9a8d4'
  },
  march: {
    key: 'march',
    label: 'March',
    accentColor: '#16a34a',
    background: '#f7fff8',
    surface: '#ffffff',
    surfaceAlt: '#eefcf2',
    borderColor: '#c7f0d2',
    textPrimary: '#14532d',
    textMuted: '#4b5563',
    headerGradient: 'linear-gradient(135deg, #eefcf2 0%, #ffffff 55%, #dcfce7 100%)',
    tableHeaderBackground: '#eefcf2',
    totalCardBackground: '#f0fdf4',
    noteBackground: '#f0fdf4',
    logoRing: '#bbf7d0'
  },
  april: {
    key: 'april',
    label: 'April',
    accentColor: '#22c55e',
    background: '#f9fff9',
    surface: '#ffffff',
    surfaceAlt: '#f0fdf4',
    borderColor: '#bbf7d0',
    textPrimary: '#14532d',
    textMuted: '#4b5563',
    headerGradient: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 55%, #dcfce7 100%)',
    tableHeaderBackground: '#f0fdf4',
    totalCardBackground: '#f0fdf4',
    noteBackground: '#f0fdf4',
    logoRing: '#86efac'
  },
  may: {
    key: 'may',
    label: 'May',
    accentColor: '#65a30d',
    background: '#fbfff5',
    surface: '#ffffff',
    surfaceAlt: '#f7fee7',
    borderColor: '#d9f99d',
    textPrimary: '#365314',
    textMuted: '#4b5563',
    headerGradient: 'linear-gradient(135deg, #f7fee7 0%, #ffffff 55%, #ecfccb 100%)',
    tableHeaderBackground: '#f7fee7',
    totalCardBackground: '#f7fee7',
    noteBackground: '#f7fee7',
    logoRing: '#bef264'
  },
  june: {
    key: 'june',
    label: 'June',
    accentColor: '#0ea5e9',
    background: '#f5fbff',
    surface: '#ffffff',
    surfaceAlt: '#f0f9ff',
    borderColor: '#bae6fd',
    textPrimary: '#082f49',
    textMuted: '#475569',
    headerGradient: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 55%, #e0f2fe 100%)',
    tableHeaderBackground: '#f0f9ff',
    totalCardBackground: '#f0f9ff',
    noteBackground: '#f0f9ff',
    logoRing: '#7dd3fc'
  },
  july: {
    key: 'july',
    label: 'July',
    accentColor: '#f97316',
    background: '#fffaf5',
    surface: '#ffffff',
    surfaceAlt: '#fff7ed',
    borderColor: '#fed7aa',
    textPrimary: '#431407',
    textMuted: '#78716c',
    headerGradient: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 55%, #ffedd5 100%)',
    tableHeaderBackground: '#fff7ed',
    totalCardBackground: '#fff7ed',
    noteBackground: '#fff7ed',
    logoRing: '#fdba74'
  },
  august: {
    key: 'august',
    label: 'August',
    accentColor: '#ea580c',
    background: '#fff8f1',
    surface: '#ffffff',
    surfaceAlt: '#fff4e6',
    borderColor: '#fdba74',
    textPrimary: '#431407',
    textMuted: '#78716c',
    headerGradient: 'linear-gradient(135deg, #fff4e6 0%, #ffffff 55%, #ffedd5 100%)',
    tableHeaderBackground: '#fff4e6',
    totalCardBackground: '#fff4e6',
    noteBackground: '#fff4e6',
    logoRing: '#fb923c'
  },
  september: {
    key: 'september',
    label: 'September',
    accentColor: '#ca8a04',
    background: '#fffdf5',
    surface: '#ffffff',
    surfaceAlt: '#fefce8',
    borderColor: '#fde68a',
    textPrimary: '#422006',
    textMuted: '#6b7280',
    headerGradient: 'linear-gradient(135deg, #fefce8 0%, #ffffff 55%, #fef3c7 100%)',
    tableHeaderBackground: '#fefce8',
    totalCardBackground: '#fefce8',
    noteBackground: '#fefce8',
    logoRing: '#fcd34d'
  },
  october: {
    key: 'october',
    label: 'October',
    accentColor: '#c2410c',
    background: '#fffaf5',
    surface: '#ffffff',
    surfaceAlt: '#fff7ed',
    borderColor: '#fdba74',
    textPrimary: '#431407',
    textMuted: '#78716c',
    headerGradient: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 55%, #fed7aa 100%)',
    tableHeaderBackground: '#fff7ed',
    totalCardBackground: '#fff7ed',
    noteBackground: '#fff7ed',
    logoRing: '#fb923c'
  },
  november: {
    key: 'november',
    label: 'November',
    accentColor: '#92400e',
    background: '#fffbf5',
    surface: '#ffffff',
    surfaceAlt: '#fef3c7',
    borderColor: '#fcd34d',
    textPrimary: '#451a03',
    textMuted: '#6b7280',
    headerGradient: 'linear-gradient(135deg, #fef3c7 0%, #ffffff 55%, #fde68a 100%)',
    tableHeaderBackground: '#fef3c7',
    totalCardBackground: '#fff7dd',
    noteBackground: '#fff7dd',
    logoRing: '#fbbf24'
  },
  december: {
    key: 'december',
    label: 'December',
    accentColor: '#0f766e',
    background: '#f4fffd',
    surface: '#ffffff',
    surfaceAlt: '#ecfeff',
    borderColor: '#99f6e4',
    textPrimary: '#134e4a',
    textMuted: '#64748b',
    headerGradient: 'linear-gradient(135deg, #ecfeff 0%, #ffffff 45%, #dcfce7 100%)',
    tableHeaderBackground: '#ecfeff',
    totalCardBackground: '#f0fdfa',
    noteBackground: '#f0fdfa',
    logoRing: '#5eead4'
  }
};

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

const parseInvoiceMonth = (value?: string | null): number | null => {
  if (!value) return null;

  const normalized = value.trim();

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const month = Number(isoMatch[2]);
    return Number.isFinite(month) ? month : null;
  }

  const slashMatch = normalized.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);

    if (second >= 1 && second <= 12) return second;
    if (first >= 1 && first <= 12) return first;
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getMonth() + 1;
  }

  return null;
};

export const resolveInvoiceTheme = (
  settings: InvoiceEditorSettings & {
    templateMode?: InvoiceTemplateMode;
    templateKey?: InvoiceTemplateKey;
    useTemplateAccentColor?: boolean;
  },
  issueDate?: string
): InvoiceResolvedTheme => {
  const month = parseInvoiceMonth(issueDate) ?? new Date().getMonth() + 1;

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

  return {
    ...template,
    accentColor:
      settings.useTemplateAccentColor === false
        ? settings.accentColor ?? template.accentColor
        : template.accentColor
  };
};