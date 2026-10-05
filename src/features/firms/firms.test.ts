import { addFirm, allFirmKeys, DEFAULT_FIRM, firmKey, isFirmKey, readFirms, removeFirm, setActiveFirm } from '../../lib/firms';
import { collectData, fromBackupFile, summarize, toBackupFile } from '../../lib/backup';
import { createEmptyStore, createInvoice, createLineItem } from '../invoices/model';
import { summarizeFirm } from './summary';

beforeEach(() => localStorage.clear());

describe('firms', () => {
  it('keeps the first firm on the original keys and gives others their own', () => {
    expect(readFirms()).toMatchObject({ activeId: DEFAULT_FIRM });
    expect(firmKey('studio.invoices.v2', DEFAULT_FIRM)).toBe('studio.invoices.v2');
    const firm = addFirm('Petar Petrović PR');
    expect(readFirms().activeId).toBe(firm.id);
    expect(firmKey('studio.kpo.v1', firm.id)).toBe(`studio.kpo.v1@${firm.id}`);
    expect(allFirmKeys()).toEqual(['studio.invoices.v2', 'studio.kpo.v1', 'studio.audit.v1', `studio.invoices.v2@${firm.id}`, `studio.kpo.v1@${firm.id}`, `studio.audit.v1@${firm.id}`]);
    expect(isFirmKey(`studio.invoices.v2@${firm.id}`)).toBe(true);
    expect(isFirmKey('studio.ai.key')).toBe(false);
    setActiveFirm(DEFAULT_FIRM);
    expect(readFirms().activeId).toBe(DEFAULT_FIRM);
  });

  it('backs up and restores every firm, and never deletes the first one', () => {
    const firm = addFirm('Druga firma');
    localStorage.setItem('studio.invoices.v2', JSON.stringify({ invoices: [{}, {}] }));
    localStorage.setItem(`studio.invoices.v2@${firm.id}`, JSON.stringify({ invoices: [{}] }));
    const data = collectData();
    expect(summarize(data).invoices).toBe(3);
    expect(Object.keys(fromBackupFile(toBackupFile({ createdAt: new Date().toISOString(), data }))!)).toContain(`studio.invoices.v2@${firm.id}`);
    removeFirm(DEFAULT_FIRM);
    expect(readFirms().firms).toHaveLength(2);
    removeFirm(firm.id);
    expect(readFirms().firms).toHaveLength(1);
    expect(localStorage.getItem(`studio.invoices.v2@${firm.id}`)).toBeNull();
  });

  it('summarises a firm for the accountant', () => {
    const store = createEmptyStore();
    store.profile.party.name = 'Petar PR';
    const paid = { ...createInvoice(store), status: 'paid' as const, issueDate: '2026-03-01' };
    paid.items = [createLineItem({ quantity: 1, unitPrice: 1000 })];
    const late = { ...createInvoice(store), status: 'sent' as const, issueDate: '2026-09-01', dueDate: '2026-09-15' };
    late.items = [createLineItem({ quantity: 1, unitPrice: 500 })];
    store.invoices = [paid, late];
    const summary = summarizeFirm(JSON.stringify(store), null, 2026, '2026-10-05');
    expect(summary).toMatchObject({ name: 'Petar PR', invoiceCount: 2, fromBook: false, overdue: 1, taxEntered: false });
    expect(summary.incomeEur).toBeCloseTo(1000);
    expect(summary.unpaidEur).toBeCloseTo(500);
  });
});
