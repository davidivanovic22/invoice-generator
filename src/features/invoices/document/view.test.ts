import { createEmptyStore, createInvoice } from '../model';
import { buildInvoiceView } from './view';

test('legacy service dates are omitted from invoice preview and PDF metadata', () => {
  const store = createEmptyStore();
  const invoice = createInvoice(store);
  invoice.issueDate = '2026-10-01';
  invoice.dueDate = '2026-10-14';
  invoice.serviceDate = '2026-03-31';
  invoice.billingPeriod = 'September 2026';
  for (const language of ['en', 'sr', 'en-sr'] as const) {
    invoice.design.language = language;
    const view = buildInvoiceView(invoice, store.profile);
    expect(view.meta).toHaveLength(3);
    expect(view.meta.map(item => item.value)).toContain('September 2026');
    expect(view.meta.some(item => /service|prometa/i.test(item.label))).toBe(false);
  }
});

test.each(['en', 'sr'] as const)('issuer identifiers use %s while retaining both numbers', language => {
  const store = createEmptyStore();
  const invoice = createInvoice(store);
  invoice.issuer = { ...invoice.issuer, taxId: '123456789', regNo: '12345678', taxIdLabel: '', regIdLabel: '' };
  invoice.design.language = language;
  const view = buildInvoiceView(invoice, store.profile);
  expect(view.issuer.lines).toContain(`${language === 'en' ? 'Tax ID' : 'PIB'}: 123456789`);
  expect(view.issuer.lines).toContain(`${language === 'en' ? 'Company registration number' : 'Matični broj'}: 12345678`);
});

test('signature visibility hides inherited and own signatures without deleting either', () => {
  const store = createEmptyStore();
  store.profile.signature = 'business-signature';
  const invoice = createInvoice(store);
  invoice.signature = 'invoice-signature';
  invoice.design.showSignature = false;
  expect(buildInvoiceView(invoice, store.profile).signature).toBe('');
  invoice.design.showSignature = true;
  expect(buildInvoiceView(invoice, store.profile).signature).toBe('invoice-signature');
  invoice.signature = '';
  expect(buildInvoiceView(invoice, store.profile).signature).toBe('business-signature');
  expect(store.profile.signature).toBe('business-signature');
});

test('custom issuer tax and registration labels are preserved in every document language', () => {
  const store = createEmptyStore();
  const invoice = createInvoice(store);
  invoice.issuer = { ...invoice.issuer, taxId: '123', regNo: '456', taxIdLabel: 'VAT ID', regIdLabel: 'MB' };
  for (const language of ['en', 'sr', 'en-sr'] as const) {
    invoice.design.language = language;
    const view = buildInvoiceView(invoice, store.profile);
    expect(view.issuer.lines).toContain('VAT ID: 123');
    expect(view.issuer.lines).toContain('MB: 456');
  }
});
