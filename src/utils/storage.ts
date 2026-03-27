import type {
  EditorElement,
  InvoiceData,
  InvoiceEditorSettings,
  InvoiceItem,
  InvoicesState,
  PartyDetails
} from '../types/invoice';
import { createEditorSettings } from './invoice';
import { todayIso } from './dates';

const STORAGE_KEY = 'invoice-generator';

const DEFAULT_LOGO_ELEMENT: EditorElement = {
  id: crypto.randomUUID(),
  type: 'logo',
  x: 32,
  y: 24,
  width: 128,
  height: 80,
  text: '',
  fontSize: 16
};

const DEFAULT_SIGNATURE_ELEMENT: EditorElement = {
  id: crypto.randomUUID(),
  type: 'signature',
  x: 690,
  y: 760,
  width: 220,
  height: 72,
  text: '',
  fontSize: 16
};

const normalizeParty = (party: Partial<PartyDetails> | undefined): PartyDetails => ({
  name: party?.name ?? '',
  address: party?.address ?? '',
  cityCountry: party?.cityCountry ?? '',
  taxIdLabel: party?.taxIdLabel ?? 'Tax ID',
  taxIdValue: party?.taxIdValue ?? '',
  regIdLabel: party?.regIdLabel ?? 'Reg. No.',
  regIdValue: party?.regIdValue ?? '',
  iban: party?.iban ?? ''
});

const normalizeItem = (
  item: Partial<InvoiceItem> | undefined,
  index: number
): InvoiceItem => ({
  id: item?.id ?? `item-${index}`,
  serviceName: item?.serviceName ?? 'Software development',
  description: item?.description ?? '',
  hours: typeof item?.hours === 'number' ? item.hours : 0,
  rate: typeof item?.rate === 'number' ? item.rate : 0
});

const normalizeElement = (
  element: Partial<EditorElement> | undefined,
  index: number
): EditorElement => ({
  id: element?.id ?? `element-${index}`,
  type: element?.type ?? 'text',
  x: typeof element?.x === 'number' ? element.x : 40,
  y: typeof element?.y === 'number' ? element.y : 40,
  width: typeof element?.width === 'number' ? element.width : 220,
  height: typeof element?.height === 'number' ? element.height : 48,
  text: element?.text ?? 'Editable text',
  fontSize: typeof element?.fontSize === 'number' ? element.fontSize : 16
});

const ensureRequiredElements = (elements: EditorElement[]): EditorElement[] => {
  const normalized = [...elements];

  const logoIndex = normalized.findIndex((element) => element.type === 'logo');
  const signatureIndex = normalized.findIndex((element) => element.type === 'signature');

  if (logoIndex === -1) {
    normalized.push({
      ...DEFAULT_LOGO_ELEMENT,
      id: crypto.randomUUID()
    });
  } else {
    const logoElement = normalized[logoIndex];
    normalized[logoIndex] = {
      ...logoElement,
      x: typeof logoElement.x === 'number' ? logoElement.x : 32,
      y: typeof logoElement.y === 'number' ? logoElement.y : 24,
      width: typeof logoElement.width === 'number' ? logoElement.width : 128,
      height: typeof logoElement.height === 'number' ? logoElement.height : 80
    };
  }

  if (signatureIndex === -1) {
    normalized.push({
      ...DEFAULT_SIGNATURE_ELEMENT,
      id: crypto.randomUUID()
    });
  } else {
    const signatureElement = normalized[signatureIndex];
    normalized[signatureIndex] = {
      ...signatureElement,
      x: typeof signatureElement.x === 'number' ? signatureElement.x : 690,
      y: typeof signatureElement.y === 'number' ? signatureElement.y : 760,
      width: typeof signatureElement.width === 'number' ? signatureElement.width : 220,
      height: typeof signatureElement.height === 'number' ? signatureElement.height : 72
    };
  }

  return normalized;
};

const normalizeEditorSettings = (
  settings: Partial<
    InvoiceEditorSettings & {
      templateMode?: 'manual' | 'auto-season' | 'auto-month';
      templateKey?:
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
      useTemplateAccentColor?: boolean;
    }
  > | undefined
) => {
  const safeSettings = settings ?? {};
  const rawElements = Array.isArray(safeSettings.elements) ? safeSettings.elements : [];
  const elements: EditorElement[] = rawElements.map((element, index) =>
    normalizeElement(element, index)
  );

  return createEditorSettings({
    ...safeSettings,
    baseFontSize:
      typeof safeSettings.baseFontSize === 'number' ? safeSettings.baseFontSize : 16,
    titleFontSize:
      typeof safeSettings.titleFontSize === 'number' ? safeSettings.titleFontSize : 44,
    accentColor: safeSettings.accentColor ?? '#2563eb',
    signatureWidth:
      typeof safeSettings.signatureWidth === 'number' ? safeSettings.signatureWidth : 180,
    signatureHeight:
      typeof safeSettings.signatureHeight === 'number' ? safeSettings.signatureHeight : 56,
    logoWidth: typeof safeSettings.logoWidth === 'number' ? safeSettings.logoWidth : 128,
    logoHeight: typeof safeSettings.logoHeight === 'number' ? safeSettings.logoHeight : 80,
    elements: ensureRequiredElements(elements),
    templateMode: safeSettings.templateMode ?? 'manual',
    templateKey: safeSettings.templateKey ?? 'winter',
    useTemplateAccentColor: safeSettings.useTemplateAccentColor ?? true
  });
};

export const normalizeInvoice = (invoice: Partial<InvoiceData>): InvoiceData => {
  const now = new Date().toISOString();

  return {
    id: invoice.id ?? crypto.randomUUID(),
    logo: invoice.logo ?? '',
    signature: invoice.signature ?? '',
    issuer: normalizeParty(invoice.issuer),
    client: normalizeParty(invoice.client),
    invoiceNumber: invoice.invoiceNumber ?? '',
    billingPeriod: invoice.billingPeriod ?? '',
    issueDate: invoice.issueDate ?? todayIso(),
    serviceDate: invoice.serviceDate ?? invoice.issueDate ?? todayIso(),
    dueDate: invoice.dueDate ?? todayIso(),
    currency: invoice.currency ?? 'EUR',
    vatPercent: typeof invoice.vatPercent === 'number' ? invoice.vatPercent : 0,
    note: invoice.note ?? '',
    items: Array.isArray(invoice.items)
      ? invoice.items.map((item, index) => normalizeItem(item, index))
      : [],
    editorSettings: normalizeEditorSettings(invoice.editorSettings),
    createdAt: invoice.createdAt ?? now,
    updatedAt: invoice.updatedAt ?? now
  };
};

export const loadInvoicesState = (): InvoicesState | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<InvoicesState>;

    if (!Array.isArray(parsed.invoices)) {
      return null;
    }

    const invoices = parsed.invoices.map((invoice) => normalizeInvoice(invoice));

    const activeInvoiceId =
      parsed.activeInvoiceId && invoices.some((invoice) => invoice.id === parsed.activeInvoiceId)
        ? parsed.activeInvoiceId
        : invoices[0]?.id ?? null;

    return {
      invoices,
      activeInvoiceId
    };
  } catch {
    return null;
  }
};

export const saveInvoicesState = (state: InvoicesState): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearInvoicesState = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};