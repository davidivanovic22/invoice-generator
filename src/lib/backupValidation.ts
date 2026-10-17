import { z } from 'zod';
import { FIRMS_KEY } from './firms';

// Historical exports may omit optional fields. Validate every provided value rather than
// letting normalizers silently discard malformed rows or replace wrong types with defaults.
const text = z.string();
const amount = z.number().finite();
const date = text.regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const id = text.min(1);
const party = z.object({ name: text, address: text, cityCountry: text, taxIdLabel: text, taxId: text, regIdLabel: text, regNo: text, email: text }).partial();
const bank = z.object({ iban: text, swift: text, bankName: text }).partial();
const uniqueRows = <T extends { id: string }>(schema: z.ZodType<T>) => z.array(schema).refine(rows => new Set(rows.map(row => row.id)).size === rows.length);
const items = uniqueRows(z.object({ id, title: text.optional(), description: text.optional(), quantity: amount.optional(), unit: text.optional(), unitPrice: amount.optional() }));
const invoices = uniqueRows(z.object({
  id, number: text.optional(), status: z.enum(['draft', 'sent', 'paid', 'cancelled']).optional(),
  issueDate: date.optional(), serviceDate: date.optional(), dueDate: date.optional(), paidAt: date.nullable().optional(),
  currency: text.optional(), vatPercent: amount.optional(), items: items.optional(),
  issuer: party.optional(), client: party.optional(), bank: bank.optional(), clientId: text.nullable().optional(),
  billingPeriod: text.optional(), note: text.optional(), logo: text.optional(), signature: text.optional(),
  repeatDay: z.number().int().min(1).max(31).nullable().optional(), createdAt: text.optional(), updatedAt: text.optional(),
  design: z.object({ template: z.enum(['classic', 'modern', 'minimal', 'bold', 'seasonal']), accentColor: text, language: z.enum(['en', 'sr', 'en-sr']), showSignature: z.boolean(), seasonalMonth: text.nullable(), seasonalVariant: z.number().int().nullable() }).partial().optional()
}));
const tax = z.object({ monthly: amount, currency: z.enum(['EUR', 'RSD']), rsdPerEur: amount, paidMonths: z.array(z.number().int().min(1).max(12)).optional() });
const invoiceStore = z.object({
  version: z.literal(2).optional(), invoices,
  clients: uniqueRows(z.object({ id, party: party.optional(), currency: text.optional(), lastUsedAt: text.optional() })).optional(),
  profile: z.object({ party: party.optional(), bank: bank.optional(), logo: text.optional(), signature: text.optional(), yearlyTax: z.record(text, tax).optional(),
    defaults: z.object({ currency: text, vatPercent: amount, paymentDays: amount, note: text, numberPrefix: text, language: text, template: text, accentColor: text, unit: text }).partial().optional()
  }).optional()
});
const kpo = z.object({
  version: z.literal(1).optional(), currency: z.enum(['EUR', 'RSD']).optional(), bookOn: z.enum(['paid', 'issued']).optional(),
  header: z.record(text, text).optional(), entryTemplate: text.optional(), settledInvoiceIds: z.array(text).optional(),
  entries: uniqueRows(z.object({ id, date: date.optional(), description: text.optional(), products: amount.optional(), services: amount.optional(), source: z.enum(['invoice', 'import', 'manual']).optional(), invoiceId: text.nullable().optional() }))
});
const registry = z.object({ activeId: id, firms: uniqueRows(z.object({ id, name: text, createdAt: text, cloudId: id.optional(), role: z.enum(['owner', 'accountant', 'viewer']).optional() })).min(1) })
  .refine(value => value.firms.some(firm => firm.id === value.activeId));
const sectionBase = { id, kind: text.optional(), title: text.optional(), hidden: z.boolean().optional() };
const resumeSection = z.discriminatedUnion('type', [
  z.object({ ...sectionBase, type: z.literal('text'), text }),
  z.object({ ...sectionBase, type: z.literal('tags'), items: z.array(text) }),
  z.object({ ...sectionBase, type: z.literal('entries'), items: uniqueRows(z.object({ id, title: text, subtitle: text, location: text, start: text, end: text, description: text })) }),
  z.object({ ...sectionBase, type: z.literal('languages'), items: uniqueRows(z.object({ id, name: text, level: text })) })
]);
const resumeStore = z.object({ version: z.literal(2).optional(), resumes: uniqueRows(z.object({
  id, name: text.optional(), coverLetter: text.optional(), createdAt: text.optional(), updatedAt: text.optional(),
  personal: z.object({ fullName: text, headline: text, email: text, phone: text, location: text, website: text, linkedin: text, github: text, photo: text, extras: uniqueRows(z.object({ id, label: text, value: text })) }).partial().optional(),
  design: z.object({ template: z.enum(['modern', 'classic', 'minimal', 'executive', 'creative', 'compact']), accentColor: text, font: z.enum(['sans', 'dm', 'grotesk', 'serif', 'elegant']), density: z.enum(['compact', 'normal', 'relaxed']), showPhoto: z.boolean(), language: z.enum(['en', 'sr']) }).partial().optional(),
  ats: z.object({ jobDescription: text, keywords: z.array(text), keywordsSource: text }).partial().optional(),
  sections: uniqueRows(resumeSection).optional()
})) });
const audit = z.array(z.object({ at: text, who: text, action: text, target: text, detail: text.optional() }));

export const validBackupDocument = (key: string, value: unknown): boolean => {
  if (key === FIRMS_KEY) return registry.safeParse(value).success;
  if (key === 'studio.resumes.v2') return resumeStore.safeParse(value).success;
  if (/^studio\.invoices\.v2(@.+)?$/.test(key)) return invoiceStore.safeParse(value).success;
  if (/^studio\.kpo\.v1(@.+)?$/.test(key)) return kpo.safeParse(value).success;
  if (/^studio\.audit\.v1(@.+)?$/.test(key)) return audit.safeParse(value).success;
  return false;
};
