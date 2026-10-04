import type { InvoiceMonthTemplateKey, InvoiceTemplateKey } from '../types/invoice-template';
import { INVOICE_THEMES, type InvoiceResolvedTheme } from './invoiceTheme';

// `InvoiceResolvedTheme` (invoiceTheme.ts) is the single source of truth for
// every theme's colors and artwork — this module just re-exposes it under
// the naming the template picker UI expects, so the two never drift apart.
export type InvoiceResolvedTemplate = InvoiceResolvedTheme;

export const INVOICE_TEMPLATES: Record<InvoiceTemplateKey, InvoiceResolvedTemplate> = INVOICE_THEMES;

export const getInvoiceTemplate = (key?: InvoiceTemplateKey | null): InvoiceResolvedTemplate => {
  if (!key) {
    return INVOICE_TEMPLATES.winter;
  }

  return INVOICE_TEMPLATES[key] ?? INVOICE_TEMPLATES.winter;
};

export const getSeasonTemplateKeyByMonth = (month: number): InvoiceTemplateKey => {
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

export const getMonthTemplateKey = (month: number): InvoiceMonthTemplateKey => {
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
