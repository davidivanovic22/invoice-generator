import { LEGACY_KEY, loadInvoiceStore, migrateLegacy, STORE_KEY } from './migrate';
import { invoiceTotals } from './model';

const legacyInvoice = {
  id: 'old-1',
  invoiceNumber: 'InvoiceDavidIvanovic-2026-09',
  billingPeriod: 'September 2026',
  issueDate: '2026-09-30',
  dueDate: '2026-10-14',
  currency: 'EUR',
  vatPercent: 0,
  note: 'Not in the VAT system.',
  logo: 'data:image/png;base64,LOGO',
  signature: 'data:image/png;base64,SIG',
  issuer: { name: 'Studio Sever', taxIdLabel: 'PIB / VAT', taxIdValue: '112233445', regIdLabel: 'Reg. No.', regIdValue: '1', iban: 'RS35' },
  client: { name: 'Valamar', cityCountry: 'Poreč, Croatia', taxIdLabel: 'OIB / VAT', taxIdValue: '362' },
  items: [
    { id: 'a', serviceName: 'Development', description: 'Monthly work', hours: 165, rate: 20 },
    { id: 'b', serviceName: 'Review', hours: 7.5, rate: 33.33 }
  ],
  editorSettings: { templateMode: 'manual', templateKey: 'march', templateVariantIndex: 2, elements: [{ type: 'text', text: 'Thank you!' }] },
  updatedAt: '2026-09-30T10:00:00Z'
};

describe('migrateLegacy', () => {
  const store = migrateLegacy({ invoices: [legacyInvoice, { ...legacyInvoice, id: 'old-2', updatedAt: '2026-08-01T00:00:00Z' }] });
  const invoice = store.invoices[0];

  it('keeps every invoice with its number, dates and amounts', () => {
    expect(store.invoices).toHaveLength(2);
    expect(invoice.number).toBe('InvoiceDavidIvanovic-2026-09');
    expect(invoice.issueDate).toBe('2026-09-30');
    expect(invoice.items.map((item) => [item.title, item.quantity, item.unitPrice, item.unit])).toEqual([
      ['Development', 165, 20, 'h'],
      ['Review', 7.5, 33.33, 'h']
    ]);
    expect(invoiceTotals(invoice).totalMinor).toBe(354998);
  });

  it('keeps the seasonal look the invoice was made with', () => {
    expect(invoice.design).toMatchObject({ template: 'seasonal', seasonalMonth: 'march', seasonalVariant: 2 });
  });

  it('moves free-positioned text boxes into the note', () => {
    expect(invoice.note).toBe('Not in the VAT system.\nThank you!');
    expect(store.profile.defaults.note).toBe('Not in the VAT system.');
  });

  it('builds the business profile and client list from the invoices', () => {
    expect(store.profile.party.name).toBe('Studio Sever');
    expect(store.profile.party.taxIdLabel).toBe('PIB / VAT');
    expect(store.profile.party.regIdLabel).toBe('');
    expect(store.profile.bank.iban).toBe('RS35');
    expect(store.profile.logo).toBe('data:image/png;base64,LOGO');
    expect(store.clients).toHaveLength(1);
    expect(store.clients[0].party.name).toBe('Valamar');
    expect(invoice.clientId).toBe(store.clients[0].id);
  });

  it('stores images once on the profile instead of per invoice', () => {
    expect(store.invoices.every((item) => item.logo === '' && item.signature === '')).toBe(true);
  });

  it('ignores the old placeholder issuer and client', () => {
    const placeholder = migrateLegacy({
      invoices: [{ ...legacyInvoice, issuer: { name: 'Your Company / Name' }, client: { name: 'Client Company' } }]
    });
    expect(placeholder.profile.party.name).toBe('');
    expect(placeholder.clients).toHaveLength(0);
  });
});

describe('loadInvoiceStore', () => {
  it('migrates legacy data and leaves the old key as a backup', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ invoices: [legacyInvoice] }));
    const { store, persist } = loadInvoiceStore();
    expect(persist).toBe(true);
    expect(store.invoices).toHaveLength(1);
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}').version).toBe(2);
  });

  it('backs up unreadable data instead of discarding it', () => {
    localStorage.setItem(STORE_KEY, '{not json');
    const { store, persist } = loadInvoiceStore();
    expect(store.invoices).toHaveLength(0);
    expect(persist).toBe(true);
    const backupKey = Object.keys(localStorage).find((key) => key.startsWith(`${STORE_KEY}.backup.`));
    expect(backupKey).toBeDefined();
    expect(localStorage.getItem(backupKey!)).toBe('{not json');
  });
});
