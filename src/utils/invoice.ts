import type {
  EditorElement,
  InvoiceData,
  InvoiceEditorSettings,
  InvoiceItem,
  PartyDetails
} from '../types/invoice';
import { addDaysIso, currentBillingPeriod, todayIso } from './dates';

export const createId = (): string => crypto.randomUUID();

export const createInvoiceNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 900 + 100);

  return `${year}-${month}-${random}`;
};

export const createParty = (
  overrides?: Partial<PartyDetails>
): PartyDetails => ({
  name: '',
  address: '',
  cityCountry: '',
  taxIdLabel: 'Tax ID',
  taxIdValue: '',
  regIdLabel: 'Reg. No.',
  regIdValue: '',
  iban: '',
  ...overrides
});

export const createInvoiceItem = (
  overrides?: Partial<InvoiceItem>
): InvoiceItem => ({
  id: createId(),
  serviceName: 'Software development',
  description: 'Development services',
  hours: 0,
  rate: 20,
  ...overrides
});

export const createEditorElement = (
  overrides?: Partial<EditorElement>
): EditorElement => ({
  id: createId(),
  type: 'text',
  x: 40,
  y: 40,
  width: 220,
  height: 48,
  text: 'Editable text',
  fontSize: 16,
  ...overrides
});

const ensureRequiredElements = (elements: EditorElement[]): EditorElement[] => {
  const normalized = [...elements];

  const hasLogo = normalized.some((element) => element.type === 'logo');
  const hasSignature = normalized.some((element) => element.type === 'signature');

  if (!hasLogo) {
    normalized.push(
      createEditorElement({
        type: 'logo',
        x: 32,
        y: 24,
        width: 128,
        height: 80,
        text: ''
      })
    );
  }

  if (!hasSignature) {
    normalized.push(
      createEditorElement({
        type: 'signature',
        x: 690,
        y: 980,
        width: 220,
        height: 72,
        text: ''
      })
    );
  }

  return normalized.map((element) => ({
    ...element,
    x: typeof element.x === 'number' ? element.x : 40,
    y: typeof element.y === 'number' ? element.y : 40,
    width: typeof element.width === 'number' ? element.width : 220,
    height: typeof element.height === 'number' ? element.height : 48,
    fontSize: typeof element.fontSize === 'number' ? element.fontSize : 16,
    text: element.text ?? ''
  }));
};

export const createEditorSettings = (
  partial?: Partial<InvoiceEditorSettings>
): InvoiceEditorSettings => {
  const safePartial = partial ?? {};

  const elements: EditorElement[] = Array.isArray(safePartial.elements)
    ? safePartial.elements
    : [];

  return {
    baseFontSize: typeof safePartial.baseFontSize === 'number' ? safePartial.baseFontSize : 16,
    titleFontSize:
      typeof safePartial.titleFontSize === 'number' ? safePartial.titleFontSize : 44,
    accentColor: safePartial.accentColor ?? '#2563eb',
    logoWidth: typeof safePartial.logoWidth === 'number' ? safePartial.logoWidth : 128,
    logoHeight: typeof safePartial.logoHeight === 'number' ? safePartial.logoHeight : 80,
    signatureWidth:
      typeof safePartial.signatureWidth === 'number' ? safePartial.signatureWidth : 180,
    signatureHeight:
      typeof safePartial.signatureHeight === 'number' ? safePartial.signatureHeight : 80,
    templateMode: safePartial.templateMode ?? 'manual',
    templateKey: safePartial.templateKey ?? 'winter',
    useTemplateAccentColor: safePartial.useTemplateAccentColor ?? true,
    elements: ensureRequiredElements(elements)
  };
};

export const createInvoice = (): InvoiceData => {
  const now = new Date().toISOString();

  return {
    id: createId(),
    logo: '',
    signature: '',
    issuer: createParty({
      name: 'Your Company / Name',
      address: 'Your Street 1',
      cityCountry: 'City, Country',
      taxIdLabel: 'PIB / VAT',
      regIdLabel: 'Registration No.'
    }),
    client: createParty({
      name: 'Client Company',
      address: 'Client Street 1',
      cityCountry: 'City, Country',
      taxIdLabel: 'OIB / VAT',
      regIdLabel: 'Reg. No.'
    }),
    invoiceNumber: createInvoiceNumber(),
    billingPeriod: currentBillingPeriod(),
    issueDate: todayIso(),
    serviceDate: todayIso(),
    dueDate: addDaysIso(14),
    currency: 'EUR',
    vatPercent: 0,
    note: 'The issuer is not in the VAT system.',
    items: [
      createInvoiceItem({
        hours: 165,
        rate: 20,
        description: 'Monthly development work'
      })
    ],
    editorSettings: createEditorSettings({
      templateMode: 'manual',
      templateKey: 'winter',
      useTemplateAccentColor: true,
      elements: [
        createEditorElement({
          type: 'logo',
          x: 32,
          y: 24,
          width: 128,
          height: 80,
          text: ''
        }),
        createEditorElement({
          type: 'signature',
          x: 690,
          y: 980,
          width: 220,
          height: 72,
          text: ''
        })
      ]
    }),
    createdAt: now,
    updatedAt: now
  };
};

export const calculateSubtotal = (invoice: InvoiceData): number =>
  invoice.items.reduce((sum, item) => sum + item.hours * item.rate, 0);

export const calculateTotalHours = (invoice: InvoiceData): number =>
  invoice.items.reduce((sum, item) => sum + item.hours, 0);

export const calculateVatAmount = (invoice: InvoiceData): number =>
  calculateSubtotal(invoice) * (invoice.vatPercent / 100);

export const calculateGrandTotal = (invoice: InvoiceData): number =>
  calculateSubtotal(invoice) + calculateVatAmount(invoice);