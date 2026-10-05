/**
 * Automatic backups of everything the app saves, with no server.
 *
 * - A snapshot of the saved data goes into IndexedDB once a day (and before
 *   every restore). Snapshots from the last 30 days are kept, and the newest
 *   10 are never deleted, however old they are.
 * - Optionally, the same snapshot is written as a JSON file into a folder the
 *   user picked on disk, so it survives clearing the browser's data.
 */
import { readRaw, suspendWrites } from './storage';

/** localStorage keys that hold user data. Secrets (AI key, lock) are left out on purpose. */
export const BACKUP_KEYS = ['studio.invoices.v2', 'studio.resumes.v2', 'studio.kpo.v1'] as const;

export const KEEP_DAYS = 30;
export const KEEP_NEWEST = 10;
const DAY = 86_400_000;

export type SnapshotReason = 'daily' | 'manual' | 'before-restore';

export type Snapshot = {
  id: string;
  createdAt: string;
  reason: SnapshotReason;
  /** Raw JSON per localStorage key, exactly as saved. */
  data: Record<string, string>;
};

export type BackupFile = { app: 'paperwork'; version: 1; createdAt: string; data: Record<string, unknown> };

// ---- Pure helpers ---------------------------------------------------------------

export const collectData = (read: (key: string) => string | null = readRaw): Record<string, string> => {
  const data: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const raw = read(key);
    if (raw !== null) data[key] = raw;
  }
  return data;
};

export const hasData = (data: Record<string, string>) => Object.keys(data).length > 0;

/** Ids of snapshots to delete: older than KEEP_DAYS and not among the newest KEEP_NEWEST. */
export const snapshotsToPrune = (snapshots: Pick<Snapshot, 'id' | 'createdAt'>[], now = new Date()): string[] => {
  const newestFirst = [...snapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return newestFirst
    .slice(KEEP_NEWEST)
    .filter((snapshot) => now.getTime() - new Date(snapshot.createdAt).getTime() > KEEP_DAYS * DAY)
    .map((snapshot) => snapshot.id);
};

const localDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** True when no snapshot was taken today. */
export const needsDailySnapshot = (snapshots: Pick<Snapshot, 'createdAt'>[], now = new Date()) =>
  !snapshots.some((snapshot) => localDay(new Date(snapshot.createdAt)) === localDay(now));

export const toBackupFile = (snapshot: Pick<Snapshot, 'createdAt' | 'data'>): BackupFile => {
  const data: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(snapshot.data)) {
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw;
    }
  }
  return { app: 'paperwork', version: 1, createdAt: snapshot.createdAt, data };
};

/** Reads a full backup file back into raw localStorage values. Returns null if it is not one. */
export const fromBackupFile = (value: unknown): Record<string, string> | null => {
  if (!value || typeof value !== 'object') return null;
  const file = value as Partial<BackupFile>;
  if (file.app !== 'paperwork' || !file.data || typeof file.data !== 'object') return null;
  const data: Record<string, string> = {};
  for (const key of BACKUP_KEYS) {
    const entry = file.data[key];
    if (entry !== undefined) data[key] = typeof entry === 'string' ? entry : JSON.stringify(entry);
  }
  return hasData(data) ? data : null;
};

export const backupFileName = (createdAt: string) => `paperwork-backup-${localDay(new Date(createdAt))}.json`;

/** Counts shown next to each snapshot. */
export const summarize = (data: Record<string, string>) => {
  const count = (key: string, field: string) => {
    try {
      const parsed = JSON.parse(data[key] ?? 'null');
      return Array.isArray(parsed?.[field]) ? parsed[field].length : 0;
    } catch {
      return 0;
    }
  };
  return { invoices: count('studio.invoices.v2', 'invoices'), resumes: count('studio.resumes.v2', 'resumes'), kpo: count('studio.kpo.v1', 'entries') };
};

// ---- IndexedDB ------------------------------------------------------------------

const DB_NAME = 'paperwork-backups';
const SNAPSHOTS = 'snapshots';
const SETTINGS = 'settings';

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(SNAPSHOTS, { keyPath: 'id' });
      request.result.createObjectStore(SETTINGS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const run = async <T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T> | void) => {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
};

export const listSnapshots = async (): Promise<Snapshot[]> => {
  const all = ((await run<Snapshot[]>(SNAPSHOTS, 'readonly', (store) => store.getAll())) ?? []) as Snapshot[];
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const pruneSnapshots = async () => {
  const doomed = snapshotsToPrune(await listSnapshots());
  if (doomed.length) await run(SNAPSHOTS, 'readwrite', (store) => doomed.forEach((id) => store.delete(id)));
};

export const takeSnapshot = async (reason: SnapshotReason): Promise<Snapshot | null> => {
  const data = collectData();
  if (!hasData(data)) return null;
  const createdAt = new Date().toISOString();
  const snapshot: Snapshot = { id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`, createdAt, reason, data };
  await run(SNAPSHOTS, 'readwrite', (store) => store.put(snapshot));
  await pruneSnapshots();
  return snapshot;
};

// ---- Folder on disk (File System Access API, Chrome and Edge) -----------------------

type PermissionMode = { mode: 'readwrite' };
type DirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (options: PermissionMode) => Promise<PermissionState>;
  requestPermission?: (options: PermissionMode) => Promise<PermissionState>;
};
type PickerWindow = Window & { showDirectoryPicker?: (options?: { id?: string; mode?: 'readwrite' }) => Promise<DirectoryHandle> };

export const folderBackupSupported = () => typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function';

const FOLDER_KEY = 'folder';
const LAST_FOLDER_WRITE = 'lastFolderWrite';

const getFolder = async () => (await run<DirectoryHandle | undefined>(SETTINGS, 'readonly', (store) => store.get(FOLDER_KEY))) as DirectoryHandle | undefined;

export type FolderState = { name: string; permission: PermissionState; lastWrite: string | null } | null;

export const folderState = async (): Promise<FolderState> => {
  const folder = await getFolder();
  if (!folder) return null;
  const permission = (await folder.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt';
  const lastWrite = ((await run<string | undefined>(SETTINGS, 'readonly', (store) => store.get(LAST_FOLDER_WRITE))) as string | undefined) ?? null;
  return { name: folder.name, permission, lastWrite };
};

/** Must be called from a click. */
export const chooseFolder = async () => {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) return null;
  const folder = await picker({ id: 'paperwork-backups', mode: 'readwrite' });
  await run(SETTINGS, 'readwrite', (store) => store.put(folder, FOLDER_KEY));
  return folder;
};

export const forgetFolder = () => run(SETTINGS, 'readwrite', (store) => store.delete(FOLDER_KEY));

/** Asks again for access after a browser restart. Must be called from a click. */
export const allowFolder = async () => {
  const folder = await getFolder();
  return folder ? ((await folder.requestPermission?.({ mode: 'readwrite' })) ?? 'denied') : 'denied';
};

/** Writes today's backup file if a folder is set up and allowed. Returns true when written. */
export const writeFolderBackup = async (snapshot?: Pick<Snapshot, 'createdAt' | 'data'>): Promise<boolean> => {
  const folder = await getFolder();
  if (!folder || (await folder.queryPermission?.({ mode: 'readwrite' })) !== 'granted') return false;
  const source = snapshot ?? { createdAt: new Date().toISOString(), data: collectData() };
  if (!hasData(source.data)) return false;
  const file = await folder.getFileHandle(backupFileName(source.createdAt), { create: true });
  const writable = await file.createWritable();
  await writable.write(JSON.stringify(toBackupFile(source), null, 2));
  await writable.close();
  await run(SETTINGS, 'readwrite', (store) => store.put(new Date().toISOString(), LAST_FOLDER_WRITE));
  return true;
};

// ---- Daily run and restore ---------------------------------------------------------

/** Asks the browser not to clear this site's storage when space runs low. */
export const requestPersistentStorage = async () => {
  try {
    if (!navigator.storage?.persist) return false;
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
};

/** Takes today's snapshot if there is none yet, and refreshes today's file in the backup folder. */
export const runDailyBackup = async () => {
  try {
    const snapshot = needsDailySnapshot(await listSnapshots()) ? await takeSnapshot('daily') : null;
    await writeFolderBackup(snapshot ?? undefined).catch(() => false);
    return snapshot;
  } catch {
    return null;
  }
};

/** Replaces the saved data and reloads. The current data is snapshotted first, so a restore can be undone. */
export const restoreData = async (data: Record<string, string>) => {
  await takeSnapshot('before-restore');
  suspendWrites();
  for (const key of BACKUP_KEYS) {
    if (data[key] !== undefined) localStorage.setItem(key, data[key]);
  }
  window.location.reload();
};
