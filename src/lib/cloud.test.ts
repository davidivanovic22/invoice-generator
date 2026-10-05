import { decide, decideFor, firmHasContent } from './cloud';

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
