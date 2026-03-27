import { InvoiceTemplateMode, InvoiceTemplateKey } from "./invoice-template";

export type PartyDetails = {
  name: string;
  address: string;
  cityCountry: string;
  taxIdLabel: string;
  taxIdValue: string;
  regIdLabel: string;
  regIdValue: string;
  iban?: string;
};

export type InvoiceItem = {
  id: string;
  serviceName: string;
  description: string;
  hours: number;
  rate: number;
};

export type EditorElementType = 'text' | 'logo' | 'signature';

export type EditorElement = {
  id: string;
  type: EditorElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number;
};

export type InvoiceEditorSettings = {
  baseFontSize: number;
  titleFontSize: number;
  accentColor: string;
  logoWidth: number;
  logoHeight: number;
  signatureWidth: number;
  signatureHeight: number;
  elements: EditorElement[];
  templateMode?: InvoiceTemplateMode;
  templateKey?: InvoiceTemplateKey;
  useTemplateAccentColor?: boolean;
};

export type InvoiceData = {
  id: string;
  logo?: string;
  signature?: string;
  issuer: PartyDetails;
  client: PartyDetails;
  invoiceNumber: string;
  billingPeriod: string;
  issueDate: string;
  serviceDate: string;
  dueDate: string;
  currency: string;
  vatPercent: number;
  note: string;
  items: InvoiceItem[];
  editorSettings: InvoiceEditorSettings;
  createdAt: string;
  updatedAt: string;
};

export type EditableInvoiceField = Exclude<
  keyof InvoiceData,
  'id' | 'items' | 'createdAt' | 'updatedAt'
>;

export type InvoicesState = {
  invoices: InvoiceData[];
  activeInvoiceId: string | null;
};