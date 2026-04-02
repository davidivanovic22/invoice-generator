import type {
  InvoiceMonthTemplateKey,
  InvoiceResolvedTemplate,
  InvoiceSeasonTemplateKey,
  InvoiceTemplateKey
} from '../types/invoice-template';

export const INVOICE_TEMPLATES: Record<InvoiceTemplateKey, InvoiceResolvedTemplate> = {
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
    accentColor: '#10b981',
    background: '#f4fffb',
    surface: '#ffffff',
    surfaceAlt: '#ecfdf5',
    borderColor: '#a7f3d0',
    textPrimary: '#064e3b',
    textMuted: '#4b5563',
    headerGradient: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 55%, #d1fae5 100%)',
    tableHeaderBackground: '#ecfdf5',
    totalCardBackground: '#f0fdf9',
    noteBackground: '#f0fdf9',
    logoRing: '#a7f3d0'
  },

  summer: {
    key: 'summer',
    label: 'Summer',
    accentColor: '#f59e0b',
    background: '#fffaf0',
    surface: '#ffffff',
    surfaceAlt: '#fffbeb',
    borderColor: '#fde68a',
    textPrimary: '#78350f',
    textMuted: '#78716c',
    headerGradient: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 55%, #fef3c7 100%)',
    tableHeaderBackground: '#fffbeb',
    totalCardBackground: '#fff7dd',
    noteBackground: '#fff7dd',
    logoRing: '#fcd34d'
  },

  autumn: {
    key: 'autumn',
    label: 'Autumn',
    accentColor: '#b45309',
    background: '#fff7ed',
    surface: '#ffffff',
    surfaceAlt: '#ffedd5',
    borderColor: '#fdba74',
    textPrimary: '#431407',
    textMuted: '#6b7280',
    headerGradient: 'linear-gradient(135deg, #ffedd5 0%, #ffffff 55%, #fdba74 100%)',
    tableHeaderBackground: '#ffedd5',
    totalCardBackground: '#fff1e6',
    noteBackground: '#fff1e6',
    logoRing: '#fb923c'
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
    accentColor: '#22c55e',
    background: '#f7fff9',
    surface: '#ffffff',
    surfaceAlt: '#f0fdf4',
    borderColor: '#bbf7d0',
    textPrimary: '#14532d',
    textMuted: '#4b5563',
    headerGradient: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 55%, #dcfce7 100%)',
    tableHeaderBackground: '#f0fdf4',
    totalCardBackground: '#f3fff6',
    noteBackground: '#f3fff6',
    logoRing: '#86efac'
  },

  april: {
    key: 'april',
    label: 'April',
    accentColor: '#06b6d4',
    background: '#f4fcff',
    surface: '#ffffff',
    surfaceAlt: '#ecfeff',
    borderColor: '#a5f3fc',
    textPrimary: '#164e63',
    textMuted: '#4b5563',
    headerGradient: 'linear-gradient(135deg, #ecfeff 0%, #ffffff 55%, #cffafe 100%)',
    tableHeaderBackground: '#ecfeff',
    totalCardBackground: '#f0fdff',
    noteBackground: '#f0fdff',
    logoRing: '#67e8f9'
  },

  may: {
    key: 'may',
    label: 'May',
    accentColor: '#84cc16',
    background: '#fbfff5',
    surface: '#ffffff',
    surfaceAlt: '#f7fee7',
    borderColor: '#d9f99d',
    textPrimary: '#365314',
    textMuted: '#4b5563',
    headerGradient: 'linear-gradient(135deg, #f7fee7 0%, #ffffff 55%, #ecfccb 100%)',
    tableHeaderBackground: '#f7fee7',
    totalCardBackground: '#faffef',
    noteBackground: '#faffef',
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
    background: '#fff8f3',
    surface: '#ffffff',
    surfaceAlt: '#fff7ed',
    borderColor: '#fed7aa',
    textPrimary: '#431407',
    textMuted: '#78716c',
    headerGradient: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 55%, #ffedd5 100%)',
    tableHeaderBackground: '#fff7ed',
    totalCardBackground: '#fff3eb',
    noteBackground: '#fff3eb',
    logoRing: '#fdba74'
  },

  august: {
    key: 'august',
    label: 'August',
    accentColor: '#ef4444',
    background: '#fff5f5',
    surface: '#ffffff',
    surfaceAlt: '#fef2f2',
    borderColor: '#fecaca',
    textPrimary: '#7f1d1d',
    textMuted: '#78716c',
    headerGradient: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 55%, #fee2e2 100%)',
    tableHeaderBackground: '#fef2f2',
    totalCardBackground: '#fff1f1',
    noteBackground: '#fff1f1',
    logoRing: '#fca5a5'
  },

  september: {
    key: 'september',
    label: 'September',
    accentColor: '#7c3aed',
    background: '#faf7ff',
    surface: '#ffffff',
    surfaceAlt: '#f5f3ff',
    borderColor: '#ddd6fe',
    textPrimary: '#3b0764',
    textMuted: '#6b7280',
    headerGradient: 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 55%, #ede9fe 100%)',
    tableHeaderBackground: '#f5f3ff',
    totalCardBackground: '#f7f4ff',
    noteBackground: '#f7f4ff',
    logoRing: '#c4b5fd'
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
    totalCardBackground: '#fff4eb',
    noteBackground: '#fff4eb',
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

export const getInvoiceTemplate = (key?: InvoiceTemplateKey | null): InvoiceResolvedTemplate => {
  if (!key) {
    return INVOICE_TEMPLATES.winter;
  }

  return INVOICE_TEMPLATES[key] ?? INVOICE_TEMPLATES.winter;
};

export const getSeasonTemplateKeyByMonth = (
  month: number
): InvoiceSeasonTemplateKey => {
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
    case 9:
    case 10:
    case 11:
    default:
      return 'autumn';
  }
};

export const getMonthTemplateKey = (
  month: number
): InvoiceMonthTemplateKey => {
  const months: InvoiceMonthTemplateKey[] = [
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

  return months[Math.max(0, Math.min(11, month - 1))];
};