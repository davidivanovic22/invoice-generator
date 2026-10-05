import type { DocLanguage } from '../model';

const dictionary = {
  invoice: ['Invoice', 'Faktura'],
  number: ['Invoice no.', 'Broj fakture'],
  issueDate: ['Issue date', 'Datum izdavanja'],
  serviceDate: ['Service date', 'Datum prometa'],
  dueDate: ['Due date', 'Rok plaćanja'],
  billingPeriod: ['Period', 'Period'],
  from: ['From', 'Izdavalac'],
  billTo: ['Bill to', 'Kupac'],
  description: ['Description', 'Opis'],
  qty: ['Qty', 'Kol.'],
  unitPrice: ['Unit price', 'Cena'],
  amount: ['Amount', 'Iznos'],
  subtotal: ['Subtotal', 'Osnovica'],
  vat: ['VAT', 'PDV'],
  total: ['Total', 'Ukupno'],
  amountDue: ['Amount due', 'Za uplatu'],
  paymentDetails: ['Payment details', 'Podaci za uplatu'],
  bank: ['Bank', 'Banka'],
  reference: ['Reference', 'Poziv na broj'],
  notes: ['Notes', 'Napomena'],
  signature: ['Authorized signature', 'Potpis'],
  // PIB is a tax ID, not a VAT number: flat-rate businesses are outside the VAT system.
  taxId: ['Tax ID', 'PIB'],
  regNo: ['Company reg. no.', 'Matični broj'],
  email: ['Email', 'Email'],
  paid: ['Paid', 'Plaćeno'],
  thankYou: ['Thank you for your business.', 'Hvala na saradnji.']
} as const;

export type LabelKey = keyof typeof dictionary;

const unitDictionary: Record<string, [string, string]> = {
  h: ['h', 'sat'],
  day: ['day', 'dan'],
  pcs: ['pcs', 'kom'],
  month: ['month', 'mes.'],
  project: ['project', 'projekat'],
  km: ['km', 'km']
};

export const makeTranslator = (language: DocLanguage) => {
  const t = (key: LabelKey): string => {
    const [en, sr] = dictionary[key];
    if (language === 'en') return en;
    if (language === 'sr') return sr;
    return en === sr ? en : `${sr} / ${en}`;
  };
  const unit = (value: string): string => {
    const entry = unitDictionary[value];
    if (!entry) return value;
    if (language === 'en') return entry[0];
    if (language === 'sr') return entry[1];
    return entry[0] === entry[1] ? entry[0] : `${entry[1]} / ${entry[0]}`;
  };
  return { t, unit };
};

export const numberLocale = (language: DocLanguage) => (language === 'en' ? 'en-US' : 'sr-Latn-RS');
