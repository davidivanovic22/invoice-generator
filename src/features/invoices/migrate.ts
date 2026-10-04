import { readJson, writeJson } from '../../lib/storage';
import { createId } from '../../lib/files';
import { todayIso } from '../../lib/dates';
import {
  createBank,
  createEmptyStore,
  createParty,
  createProfile,
  MONTHS,
  sameClient,
  type Client,
  type Invoice,
  type InvoiceDesign,
  type InvoiceStore,
  type MonthKey,
  type Party
} from './model';

export const STORE_KEY = 'studio.invoices.v2';
export const LEGACY_KEY = 'invoice-generator';

/* ---------- v1 (legacy) shapes, typed loosely: old data may be partial ---------- */

type LegacyParty = Partial<{
  name: string;
  address: string;
  cityCountry: string;
  taxIdLabel: string;
  taxIdValue: string;
  regIdLabel: string;
  regIdValue: string;
  iban: string;
}>;

type LegacyInvoice = Partial<{
  id: string;
  logo: string;
  signature: string;
  issuer: LegacyParty;
  client: LegacyParty;
  invoiceNumber: string;
  billingPeriod: string;
  issueDate: string;
  serviceDate: string;
  dueDate: string;
  currency: string;
  vatPercent: number;
  note: string;
  items: Partial<{ id: string; serviceName: string; description: string; hours: number; rate: number }>[];
  editorSettings: Partial<{
    accentColor: string;
    templateMode: string;
    templateKey: string;
    useTemplateAccentColor: boolean;
    templateVariantIndex: number;
    elements: Partial<{ type: string; text: string }>[];
  }>;
  createdAt: string;
  updatedAt: string;
}>;

type LegacyState = { invoices?: LegacyInvoice[] };

const str = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback);
const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const isoDate = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIso());

const fromLegacyParty = (party: LegacyParty | undefined): Party =>
  createParty({
    name: str(party?.name),
    address: str(party?.address),
    cityCountry: str(party?.cityCountry),
    taxIdLabel: str(party?.taxIdLabel) === 'Tax ID' ? '' : str(party?.taxIdLabel),
    taxId: str(party?.taxIdValue),
    regIdLabel: str(party?.regIdLabel) === 'Reg. No.' ? '' : str(party?.regIdLabel),
    regNo: str(party?.regIdValue)
  });

const PLACEHOLDER_NAMES = new Set(['your company / name', 'client company']);

const fromLegacyInvoice = (legacy: LegacyInvoice): Invoice => {
  const settings = legacy.editorSettings ?? {};
  const now = new Date().toISOString();
  const month = MONTHS.includes(settings.templateKey as MonthKey) ? (settings.templateKey as MonthKey) : null;

  // The old free-positioned text boxes have no place in structured templates; keep their text in the note.
  const freeText = (settings.elements ?? [])
    .filter((element) => element?.type === 'text' && str(element.text).trim() && element.text !== 'Editable text')
    .map((element) => str(element.text).trim());
  const note = [str(legacy.note), ...freeText].filter(Boolean).join('\n');

  return {
    id: str(legacy.id) || createId(),
    number: str(legacy.invoiceNumber),
    status: 'draft',
    issueDate: isoDate(legacy.issueDate),
    serviceDate: isoDate(legacy.serviceDate ?? legacy.issueDate),
    dueDate: isoDate(legacy.dueDate),
    billingPeriod: str(legacy.billingPeriod),
    currency: str(legacy.currency, 'EUR') || 'EUR',
    vatPercent: num(legacy.vatPercent),
    issuer: fromLegacyParty(legacy.issuer),
    bank: createBank({ iban: str(legacy.issuer?.iban) }),
    client: fromLegacyParty(legacy.client),
    clientId: null,
    items: (legacy.items ?? []).map((item) => ({
      id: str(item?.id) || createId(),
      title: str(item?.serviceName),
      description: str(item?.description),
      quantity: num(item?.hours),
      unit: 'h',
      unitPrice: num(item?.rate)
    })),
    note,
    logo: str(legacy.logo),
    signature: str(legacy.signature),
    design: {
      // Keep the look these invoices were made with.
      template: 'seasonal',
      accentColor: str(settings.accentColor, '#4f46e5'),
      language: 'en',
      seasonalMonth: settings.templateMode === 'manual' ? month : null,
      seasonalVariant: typeof settings.templateVariantIndex === 'number' ? settings.templateVariantIndex : null
    },
    paidAt: null,
    createdAt: str(legacy.createdAt, now),
    updatedAt: str(legacy.updatedAt, now)
  };
};

export const migrateLegacy = (legacy: LegacyState): InvoiceStore => {
  const legacyInvoices = Array.isArray(legacy.invoices) ? legacy.invoices : [];
  const invoices = legacyInvoices.map(fromLegacyInvoice);
  // The profile's default note is the user's own note, without migrated free-text boxes.
  const legacyNotes = new Map(invoices.map((invoice, index) => [invoice.id, legacyInvoices[index]?.note]));
  const byRecent = [...invoices].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const latest = byRecent[0];

  const clients: Client[] = [];
  for (const invoice of byRecent) {
    const name = invoice.client.name.trim();
    if (!name || PLACEHOLDER_NAMES.has(name.toLowerCase())) continue;
    let client = clients.find((candidate) => sameClient(candidate.party, invoice.client));
    if (!client) {
      client = { id: createId(), party: { ...invoice.client }, currency: invoice.currency, lastUsedAt: invoice.updatedAt };
      clients.push(client);
    }
    invoice.clientId = client.id;
  }

  const issuerIsPlaceholder = !latest || PLACEHOLDER_NAMES.has(latest.issuer.name.trim().toLowerCase());
  const profile = createProfile({
    party: latest && !issuerIsPlaceholder ? { ...latest.issuer } : createParty(),
    bank: latest ? { ...latest.bank } : createBank(),
    logo: byRecent.find((invoice) => invoice.logo)?.logo ?? '',
    signature: byRecent.find((invoice) => invoice.signature)?.signature ?? '',
    defaults: {
      ...createProfile().defaults,
      currency: latest?.currency ?? 'EUR',
      vatPercent: latest?.vatPercent ?? 0,
      note: str(legacyNotes.get(latest?.id ?? ''))
    }
  });

  // Images now live once on the profile; drop identical per-invoice copies to save storage.
  for (const invoice of invoices) {
    if (invoice.logo === profile.logo) invoice.logo = '';
    if (invoice.signature === profile.signature) invoice.signature = '';
  }

  return { version: 2, invoices, clients, profile };
};

/** Defensive normalisation of a stored v2 store: fills fields added in later builds. */
export const normalizeStore = (raw: Partial<InvoiceStore>): InvoiceStore => {
  const empty = createEmptyStore();
  const profile = createProfile({
    ...raw.profile,
    party: createParty(raw.profile?.party),
    bank: createBank(raw.profile?.bank),
    taxes: Array.isArray(raw.profile?.taxes) ? raw.profile.taxes : [],
    defaults: { ...empty.profile.defaults, ...raw.profile?.defaults }
  });
  const now = new Date().toISOString();
  const invoices = ((Array.isArray(raw.invoices) ? raw.invoices : []) as Partial<Invoice>[]).map(
    (invoice): Invoice => ({
      id: createId(),
      number: '',
      status: 'draft',
      issueDate: todayIso(),
      serviceDate: todayIso(),
      dueDate: todayIso(),
      billingPeriod: '',
      currency: 'EUR',
      vatPercent: 0,
      clientId: null,
      note: '',
      logo: '',
      signature: '',
      paidAt: null,
      createdAt: now,
      updatedAt: now,
      ...invoice,
      issuer: createParty(invoice.issuer),
      client: createParty(invoice.client),
      bank: createBank(invoice.bank),
      items: Array.isArray(invoice.items) ? invoice.items : [],
      design: {
        template: 'modern',
        accentColor: '#4f46e5',
        language: 'en',
        seasonalMonth: null,
        seasonalVariant: null,
        ...(invoice.design as Partial<InvoiceDesign> | undefined)
      }
    })
  );
  const clients = (Array.isArray(raw.clients) ? raw.clients : []).map((client) => ({
    ...client,
    party: createParty(client.party)
  }));
  return { version: 2, invoices, clients, profile };
};

/** `persist: false` means the stored data is unreadable and un-backed-up: never overwrite it. */
export const loadInvoiceStore = (): { store: InvoiceStore; persist: boolean } => {
  const current = readJson<Partial<InvoiceStore>>(STORE_KEY);
  if (current.status === 'ok') return { store: normalizeStore(current.value), persist: true };
  if (current.status === 'corrupt') return { store: createEmptyStore(), persist: current.backupKey !== null };

  const legacy = readJson<LegacyState>(LEGACY_KEY);
  if (legacy.status === 'ok') {
    const migrated = migrateLegacy(legacy.value);
    // The legacy key is left untouched as a backup.
    writeJson(STORE_KEY, migrated);
    return { store: migrated, persist: true };
  }
  return { store: createEmptyStore(), persist: true };
};
