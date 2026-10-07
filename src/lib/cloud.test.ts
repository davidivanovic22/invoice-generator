import { addFirm, linkFirm, readFirms, removeFirm } from './firms';
import { takeSnapshot } from './backup';

jest.mock('./backup', () => ({ collectData: () => ({}), takeSnapshot: jest.fn(async (_reason, data) => ({ data })) }));
import { decide, decideFor, firmHasContent, linkFirms, deleteOtherOwnedFirms } from './cloud';

const row = (data: unknown, updated_at = '2026-10-05T10:00:00Z') => ({ key: 'studio.invoices.v2', data, updated_at });

describe('cloud sync decisions', () => {
  it('pushes local data the cloud does not have yet', () => {
    expect(decide('{"a":1}', undefined, undefined)).toBe('push');
    expect(decide(null, undefined, undefined)).toBe('none');
  });

  it('pulls on a new device and asks when both sides differ the first time', () => {
    expect(decide(null, row({ a: 1 }), undefined)).toBe('pull');
    expect(decide('{"a":1}', row({ a: 1 }), undefined)).toBe('none');
    expect(decide('{"a":2}', row({ a: 1 }), undefined)).toBe('ask');
  });

  it('pushes local edits and pulls changes made on another device', () => {
    const synced = { syncedAt: '2026-10-05T10:00:00Z' };
    expect(decide('{"a":2}', row({ a: 1 }), { ...synced, dirty: true })).toBe('push');
    expect(decide('{"a":1}', row({ a: 1 }), { ...synced, dirty: false })).toBe('none');
    expect(decide('{"a":1}', row({ a: 3 }, '2026-10-05T11:00:00Z'), synced)).toBe('pull');
  });
});

describe('cloud sync details', () => {
  const synced = { syncedAt: '2026-10-05T10:00:00Z' };

  it('treats the same data in another key order as unchanged', () => {
    expect(decide('{"b":2,"a":1}', row({ a: 1, b: 2 }, '2026-10-05T12:00:00Z'), { ...synced, dirty: true })).toBe('none');
    expect(decide('{"b":2,"a":1}', row({ a: 1, b: 2 }), undefined)).toBe('none');
  });

  it('viewers never push and take the cloud copy', () => {
    const viewer = { readOnly: true };
    expect(decideFor(viewer, '{"a":2}', row({ a: 1 }), { ...synced, dirty: true })).toBe('none');
    expect(decideFor(viewer, '{"a":2}', row({ a: 1 }), undefined)).toBe('pull');
    expect(decideFor({ readOnly: false }, '{"a":2}', row({ a: 1 }), { ...synced, dirty: true })).toBe('push');
  });

  it('shares only firms that have something in them', () => {
    expect(firmHasContent(null)).toBe(false);
    expect(firmHasContent(JSON.stringify({ invoices: [], clients: [], profile: { party: { name: '' } } }))).toBe(false);
    expect(firmHasContent(JSON.stringify({ invoices: [{}] }))).toBe(true);
    expect(firmHasContent(JSON.stringify({ invoices: [], profile: { party: { name: 'Petar PR' } } }))).toBe(true);
  });
});



describe('firm lifecycle during sync', () => {
  beforeEach(() => localStorage.clear());
  const mockClient = (members: unknown[] = []) => {
    const select = jest.fn();
    const from = jest.fn((_table: string) => {
      const query: any = { select: jest.fn((fields: string) => { select(fields); return query; }), eq: jest.fn(() => query), then: (resolve: any) => Promise.resolve({ data: members, error: null }).then(resolve) };
      return query;
    });
    return { from, select, rpc: jest.fn(), auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) } };
  };
  it('never creates, imports, or connects firms automatically, even when PIB matches', async () => {
    localStorage.setItem('studio.invoices.v2', JSON.stringify({ profile: { party: { name: 'Firma', taxId: '123' } }, invoices: [{}] }));
    const client = mockClient([{ firm_id: 'remote', role: 'owner' }]);
    await linkFirms(client as any);
    await linkFirms(client as any);
    expect(client.rpc).not.toHaveBeenCalled();
    expect(client.select.mock.calls).toEqual([['firm_id, role'], ['firm_id, role']]);
    expect(client.from.mock.calls.every(([table]) => table === 'paperwork_members')).toBe(true);
    expect(readFirms().firms).toHaveLength(1);
    expect(readFirms().firms[0].cloudId).toBeUndefined();
  });
  it('keeps only explicitly connected firms despite duplicate remote memberships on refresh', async () => {
    linkFirm('default', 'kept', 'owner');
    const client = mockClient(['kept', 'duplicate-a', 'duplicate-b'].map(firm_id => ({ firm_id, role: 'owner' })));
    await linkFirms(client as any);
    await linkFirms(client as any);
    expect(readFirms().firms).toHaveLength(1);
    expect(readFirms().firms[0].cloudId).toBe('kept');
  });
  it('never restores a locally deleted firm from memberships', async () => {
    const deleted = addFirm('Deleted');
    linkFirm(deleted.id, 'remote', 'owner');
    removeFirm(deleted.id);
    const client = mockClient([{ firm_id: 'remote', role: 'owner' }]);
    await linkFirms(client as any);
    expect(readFirms().firms).toHaveLength(1);
    expect(readFirms().firms.some(firm => firm.cloudId === 'remote')).toBe(false);
  });
  it('refreshes roles and stops syncing after access is removed without recreating a firm', async () => {
    linkFirm('default', 'kept', 'owner');
    await linkFirms(mockClient([{ firm_id: 'kept', role: 'viewer' }]) as any);
    expect(readFirms().firms[0].role).toBe('viewer');
    const client = mockClient();
    await linkFirms(client as any);
    expect(readFirms().firms[0].cloudId).toBeUndefined();
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

describe('permanent owner-requested cleanup', () => {
  const backup = takeSnapshot as jest.Mock;
  beforeEach(() => {
    localStorage.clear();
    backup.mockReset();
    backup.mockImplementation(async (_reason, data) => ({ data }));
  });
  const mockCleanupClient = () => {
    const deletion = jest.fn();
    const events: string[] = [];
    const from = jest.fn((table: string) => {
      let deleting = false;
      let ids: string[] = [];
      const query: any = {
        select: () => query, eq: () => query,
        in: (_key: string, value: string[]) => { ids = value; return query; },
        delete: () => { deleting = true; return query; },
        then: (resolve: any) => {
          if (deleting) { deletion(ids); events.push('delete'); }
          const data = table === 'paperwork_firm_data'
            ? [{ firm_id: 'kept', key: 'invoices', data: { invoices: [{ id: 'main-document' }] } }, { firm_id: 'unwanted', key: 'invoices', data: { invoices: [{ id: 'duplicate-document' }] } }]
            : deleting ? ids.map(id => ({ id })) : ['kept', 'unwanted'].map(id => ({ id, name: id, created_at: '2026-10-07' }));
          return Promise.resolve({ data, error: null }).then(resolve);
        }
      };
      return query;
    });
    const rpc = jest.fn(async () => ({ data: [{ firm_id: 'kept', key: 'invoices', data: { invoices: [{ id: 'main-document' }] } },
      { firm_id: 'unwanted', key: 'invoices', data: { invoices: [{ id: 'duplicate-document' }] } }], error: null }));
    return { from, rpc, deletion, events, auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) } };
  };
  it('backs up both cloud copies before deleting only the other owned firms', async () => {
    const client = mockCleanupClient();
    backup.mockImplementation(async (_reason, data) => { client.events.push('backup'); return { data }; });
    expect(await deleteOtherOwnedFirms(client as any, 'kept')).toBe(1);
    expect(client.events).toEqual(['backup', 'delete']);
    expect(client.deletion).toHaveBeenCalledWith(['unwanted']);
    const data = backup.mock.calls[0][1];
    expect(JSON.parse(data['studio.invoices.v2@cloud-backup-kept']).invoices[0].id).toBe('main-document');
    expect(JSON.parse(data['studio.invoices.v2@cloud-backup-unwanted']).invoices[0].id).toBe('duplicate-document');
  });
  it('deletes nothing if backup fails or the preserved firm is not owned', async () => {
    const client = mockCleanupClient();
    backup.mockRejectedValueOnce(new Error('Backup failed'));
    await expect(deleteOtherOwnedFirms(client as any, 'kept')).rejects.toThrow('Backup failed');
    expect(client.deletion).not.toHaveBeenCalled();
    await expect(deleteOtherOwnedFirms(client as any, 'someone-elses-firm')).rejects.toThrow('own');
    expect(client.deletion).not.toHaveBeenCalled();
  });
});
