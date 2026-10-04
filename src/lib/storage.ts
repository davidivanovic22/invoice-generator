/**
 * localStorage access that never destroys data and never throws into React.
 *
 * - Unreadable JSON is copied to a timestamped backup key before the caller
 *   falls back to defaults, so a bad deploy or manual edit is recoverable.
 * - Write failures (quota, private mode) are reported to subscribers instead
 *   of crashing the effect that triggered them.
 */

export type ReadResult<T> =
  | { status: 'empty' }
  | { status: 'ok'; value: T }
  | { status: 'corrupt'; backupKey: string | null };

export type StorageIssue = { kind: 'quota' | 'unavailable' | 'corrupt'; key: string; message: string };

type Listener = (issue: StorageIssue) => void;
const listeners = new Set<Listener>();

export const onStorageIssue = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const report = (issue: StorageIssue) => listeners.forEach((listener) => listener(issue));

export const backupKeyFor = (key: string) => `${key}.backup.${new Date().toISOString()}`;

export const readJson = <T>(key: string): ReadResult<T> => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return { status: 'empty' };
  }
  if (raw === null) return { status: 'empty' };

  try {
    return { status: 'ok', value: JSON.parse(raw) as T };
  } catch {
    const backupKey = backupKeyFor(key);
    try {
      localStorage.setItem(backupKey, raw);
    } catch {
      report({
        kind: 'corrupt',
        key,
        message: 'Saved data could not be read and could not be backed up. It was left untouched.'
      });
      return { status: 'corrupt', backupKey: null };
    }
    report({
      kind: 'corrupt',
      key,
      message: `Saved data could not be read. A copy was kept under "${backupKey}".`
    });
    return { status: 'corrupt', backupKey };
  }
};

const isQuotaError = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22);

export const writeJson = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    report(
      isQuotaError(error)
        ? {
            kind: 'quota',
            key,
            message:
              'Browser storage is full, so your latest changes are not saved. Export a backup, then remove large images or old documents.'
          }
        : { kind: 'unavailable', key, message: 'Browser storage is unavailable, so changes are not being saved.' }
    );
    return false;
  }
};

export const readRaw = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
