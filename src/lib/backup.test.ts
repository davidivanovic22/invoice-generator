import { collectData, fromBackupFile, KEEP_NEWEST, needsDailySnapshot, runDailyBackup, snapshotsToPrune, summarize, toBackupFile } from './backup';

const daysAgo = (days: number, now: Date) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe('daily backup destination failures', () => {
  const operations = () => ({
    listSnapshots: jest.fn(async () => []),
    takeSnapshot: jest.fn(async () => null),
    writeFolderBackup: jest.fn(async () => true)
  });

  it('still writes to disk when browser snapshots are unavailable', async () => {
    const deps = operations();
    deps.listSnapshots.mockRejectedValueOnce(new Error('IndexedDB unavailable'));
    const result = await runDailyBackup(deps);
    expect(result.snapshotError).toBe(true);
    expect(result.folderWritten).toBe(true);
    expect(deps.writeFolderBackup).toHaveBeenCalled();
  });

  it('reports a failed disk write and clears the failure after a successful retry', async () => {
    const deps = operations();
    deps.writeFolderBackup.mockRejectedValueOnce(new Error('Disk full'));
    expect((await runDailyBackup(deps)).folderError).toBe(true);
    expect(await runDailyBackup(deps)).toMatchObject({ folderWritten: true, folderError: false });
  });

  it('does not label an unconfigured or unapproved folder as a write error', async () => {
    const deps = operations();
    deps.writeFolderBackup.mockResolvedValueOnce(false);
    expect(await runDailyBackup(deps)).toMatchObject({ folderWritten: false, folderError: false });
  });
});

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

  it('rejects unsupported versions, bad dates, wrong nested amounts and duplicate IDs', () => {
    const file = toBackupFile({ createdAt: '2026-10-05T10:00:00.000Z', data });
    expect(fromBackupFile({ ...file, version: 2 })).toBeNull();
    expect(fromBackupFile({ ...file, createdAt: 'invalid' })).toBeNull();
    const invalid = (invoices: unknown[]) => ({ ...file, data: { 'studio.invoices.v2': { version: 2, invoices } } });
    expect(fromBackupFile(invalid([{ id: 'a', items: [{ id: 'x', quantity: 'oops' }] }]))).toBeNull();
    expect(fromBackupFile(invalid([{ id: 'a' }, { id: 'a' }]))).toBeNull();
    expect(fromBackupFile(invalid([{ id: 'a', issueDate: '2026-02-30' }]))).toBeNull();
  });

  it('rejects a mixed backup atomically if any recognized document is corrupt', () => {
    const file = toBackupFile({ createdAt: '2026-10-05T10:00:00.000Z', data });
    expect(fromBackupFile({ ...file, data: { ...file.data, 'studio.kpo.v1': { entries: 'wrong' } } })).toBeNull();
  });

  it('rejects documents assigned to a firm absent from the backup registry', () => {
    const file = toBackupFile({ createdAt: '2026-10-05T10:00:00.000Z', data });
    expect(fromBackupFile({ ...file, data: { 'studio.invoices.v2@missing': { invoices: [{ id: 'a' }] } } })).toBeNull();
  });

  it('collects only user data and counts it', () => {
    const store: Record<string, string> = { ...data, 'studio.ai.key': 'secret', 'studio.lock': '{}' };
    const collected = collectData((key) => store[key] ?? null);
    expect(Object.keys(collected).sort()).toEqual(['studio.invoices.v2', 'studio.resumes.v2']);
    expect(summarize(collected)).toEqual({ invoices: 2, resumes: 1, kpo: 0 });
  });
});
