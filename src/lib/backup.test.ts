import { collectData, fromBackupFile, KEEP_NEWEST, needsDailySnapshot, snapshotsToPrune, summarize, toBackupFile } from './backup';

const daysAgo = (days: number, now: Date) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe('snapshotsToPrune', () => {
  const now = new Date(2026, 9, 5, 12);

  it('keeps everything from the last 30 days', () => {
    const snapshots = Array.from({ length: 30 }, (_, index) => ({ id: `s${index}`, createdAt: daysAgo(index, now) }));
    expect(snapshotsToPrune(snapshots, now)).toEqual([]);
  });

  it('deletes old snapshots but always keeps the newest ten', () => {
    const recent = Array.from({ length: 12 }, (_, index) => ({ id: `new${index}`, createdAt: daysAgo(index, now) }));
    const old = [
      { id: 'old1', createdAt: daysAgo(45, now) },
      { id: 'old2', createdAt: daysAgo(90, now) }
    ];
    expect(snapshotsToPrune([...old, ...recent], now).sort()).toEqual(['old1', 'old2']);
  });

  it('never deletes the newest ten, even if they are all old', () => {
    const old = Array.from({ length: KEEP_NEWEST + 2 }, (_, index) => ({ id: `o${index}`, createdAt: daysAgo(100 + index, now) }));
    expect(snapshotsToPrune(old, now)).toEqual(['o10', 'o11']);
  });
});

describe('needsDailySnapshot', () => {
  it('is true only when there is no snapshot today', () => {
    const now = new Date(2026, 9, 5, 18);
    expect(needsDailySnapshot([], now)).toBe(true);
    expect(needsDailySnapshot([{ createdAt: new Date(2026, 9, 5, 8).toISOString() }], now)).toBe(false);
    expect(needsDailySnapshot([{ createdAt: new Date(2026, 9, 4, 23).toISOString() }], now)).toBe(true);
  });
});

describe('backup files', () => {
  const data = {
    'studio.invoices.v2': JSON.stringify({ invoices: [{ id: 'a' }, { id: 'b' }] }),
    'studio.resumes.v2': JSON.stringify({ resumes: [{ id: 'r' }] })
  };

  it('round-trips through a readable JSON file', () => {
    const file = toBackupFile({ createdAt: '2026-10-05T10:00:00.000Z', data });
    expect(file.data['studio.invoices.v2']).toEqual({ invoices: [{ id: 'a' }, { id: 'b' }] });
    expect(fromBackupFile(JSON.parse(JSON.stringify(file)))).toEqual(data);
  });

  it('rejects files that are not full backups', () => {
    expect(fromBackupFile({ invoices: [] })).toBeNull();
    expect(fromBackupFile({ app: 'paperwork', version: 1, data: {} })).toBeNull();
    expect(fromBackupFile('nope')).toBeNull();
  });

  it('collects only user data and counts it', () => {
    const store: Record<string, string> = { ...data, 'studio.ai.key': 'secret', 'studio.lock': '{}' };
    const collected = collectData((key) => store[key] ?? null);
    expect(Object.keys(collected).sort()).toEqual(['studio.invoices.v2', 'studio.resumes.v2']);
    expect(summarize(collected)).toEqual({ invoices: 2, resumes: 1, kpo: 0 });
  });
});
