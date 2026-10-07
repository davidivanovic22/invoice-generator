import { act, render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { hydrateFromDatabase, decideDatabase } from './cloud';
import { disableDatabaseMode, readRaw, replaceDatabaseData, writeJson } from './storage';
import { FIRMS_KEY, firmKey, readFirms } from './firms';
import { collectData } from './backup';
import { createEmptyStore, createInvoice } from '../features/invoices/model';
import { createBook, createEntry } from '../features/kpo/model';
import { createEmptyResume } from '../features/resumes/model';
import { InvoiceStoreProvider, useInvoiceStore } from '../features/invoices/store';
import { KpoStoreProvider, useKpo } from '../features/kpo/store';
import { ResumeStoreProvider, useResumeStore } from '../features/resumes/store';
import { FirmProvider, useFirm } from '../features/firms/FirmContext';
import { useCloud } from '../features/account/CloudSection';
import { FeedbackProvider } from '../ui/Feedback';

afterEach(() => disableDatabaseMode());
beforeEach(() => { disableDatabaseMode(); localStorage.clear(); });

const fixture = (selection: unknown = null) => {
  const invoices = createEmptyStore();
  invoices.profile.party.name = 'Database business';
  invoices.invoices = [createInvoice(invoices)];
  const kpo = createBook(invoices.profile.party);
  kpo.entries = [createEntry({ services: 100 })];
  const resumes = { version: 2, resumes: [createEmptyResume()] };
  const tableReads: string[] = [];
  const from = jest.fn((table: string) => {
    let key: string | undefined;
    const query: any = {
      select: () => query,
      eq: (column: string, value: string) => { if (column === 'key') key = value; return query; },
      in: () => query,
      order: () => query,
      maybeSingle: () => query,
      then: (resolve: any) => {
        tableReads.push(table);
        const data = table === 'paperwork_members'
          ? [{ firm_id: 'existing-db-firm', role: 'owner', paperwork_firms: { name: 'Database business' } }, { firm_id: 'unselected-db-firm', role: 'owner', paperwork_firms: { name: 'Unselected business' } }]
          : table === 'paperwork_user_settings'
            ? selection ? { active_firm_id: (selection as any).activeFirmId } : null
            : table === 'paperwork_open_firms'
              ? ((selection as any)?.firmIds ?? []).map((firm_id: string, position: number) => ({ firm_id, position }))
            : [{ firm_id: 'existing-db-firm', key: 'invoices', data: invoices, updated_at: 'version-1' }, { firm_id: 'existing-db-firm', key: 'kpo', data: kpo, updated_at: 'version-1' }];
        return Promise.resolve({ data, error: null }).then(resolve);
      }
    };
    return query;
  });
  const rpc = jest.fn(async () => ({ data: [{ firm_id: null, key: 'studio.resumes.v2', data: resumes, updated_at: 'version-1' },
    { firm_id: 'existing-db-firm', key: 'invoices', data: invoices, updated_at: 'version-1' },
    { firm_id: 'existing-db-firm', key: 'kpo', data: kpo, updated_at: 'version-1' }], error: null }));
  return { from, rpc, tableReads, invoices };
};

const Probe = () => {
  const { store } = useInvoiceStore();
  const { book } = useKpo();
  const { store: resumes } = useResumeStore();
  return <div>{store.profile.party.name}: {store.invoices.length} invoices, {book.entries.length} KPO, {resumes.resumes.length} resumes</div>;
};
const Documents = () => {
  const { active, keyFor } = useFirm();
  return <InvoiceStoreProvider key={active.id} storageKey={keyFor('studio.invoices.v2')}>
    <KpoStoreProvider storageKey={keyFor('studio.kpo.v1')}><Probe /></KpoStoreProvider>
  </InvoiceStoreProvider>;
};
const Harness = () => {
  const cloud = useCloud();
  return <FeedbackProvider><FirmProvider key={cloud.dataRevision}><ResumeStoreProvider><Documents /></ResumeStoreProvider></FirmProvider></FeedbackProvider>;
};

it('replaces the empty default view with the connected database firm and updates mounted stores', async () => {
  localStorage.setItem(FIRMS_KEY, JSON.stringify({ activeId: 'default', firms: [{ id: 'default', name: '', createdAt: 'today' }, { id: 'local-main', cloudId: 'existing-db-firm', role: 'owner', name: 'Stale browser name', createdAt: 'today' }] }));
  localStorage.setItem('studio.invoices.v2@local-main', JSON.stringify({ invoices: ['obsolete-browser-document'] }));
  replaceDatabaseData({});
  render(<Harness />);
  const client = fixture();
  await act(async () => hydrateFromDatabase(client as any, { id: 'user' } as User));
  expect(screen.getByText('Database business: 1 invoices, 1 KPO, 1 resumes')).toBeInTheDocument();
  expect(readFirms().activeId).toBe('local-main');
  expect(readFirms().firms).toHaveLength(1);
  expect(JSON.parse(readRaw(firmKey('studio.invoices.v2', 'local-main'))!).invoices[0].id).toBe(client.invoices.invoices[0].id);
  const backup = collectData();
  expect(JSON.parse(backup['studio.invoices.v2@local-main']).invoices).toHaveLength(1);
  expect(client.rpc).toHaveBeenCalledWith('paperwork_read_documents', { p_firm_ids: ['existing-db-firm'], p_personal: true });
});

it('restores the explicitly chosen firm from the database on a browser without local documents', async () => {
  const client = fixture({ firmIds: ['existing-db-firm'], activeFirmId: 'existing-db-firm' });
  await hydrateFromDatabase(client as any, { id: 'user' } as User);
  expect(readFirms().firms.map(firm => firm.cloudId)).toEqual(['existing-db-firm']);
  expect(JSON.parse(readRaw(firmKey('studio.invoices.v2', readFirms().activeId))!).profile.party.name).toBe('Database business');
});

it('never reads obsolete browser documents in database mode, and keeps edits in memory', () => {
  localStorage.setItem('studio.invoices.v2', '{"old":true}');
  replaceDatabaseData({});
  expect(readRaw('studio.invoices.v2')).toBeNull();
  writeJson('studio.invoices.v2', { edited: true });
  expect(readRaw('studio.invoices.v2')).toBe('{"edited":true}');
  expect(localStorage.getItem('studio.invoices.v2')).toBe('{"old":true}');
});

it('always takes database data on first load and conflicts, and pushes only edits based on its current version', () => {
  const remote = { key: 'invoices', data: { database: true }, updated_at: 'v2' };
  expect(decideDatabase('{"old":true}', remote, undefined)).toBe('pull');
  expect(decideDatabase('{"edited":true}', remote, { syncedAt: 'v1', dirty: true })).toBe('pull');
  expect(decideDatabase('{"edited":true}', remote, { syncedAt: 'v2', dirty: true })).toBe('push');
  expect(decideDatabase('{"old":true}', undefined, undefined)).toBe('clear');
});
