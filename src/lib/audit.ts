/**
 * History of changes per firm: who changed what, and when. Kept next to the
 * firm's data (and therefore in backups and cloud sync). Typing in one invoice
 * is folded into one "edited" entry per 10 minutes.
 */
import { readLock } from '../features/account/lock';
import { getCloudState } from './cloud';
import { firmKey, readFirms } from './firms';
import { readRaw, writeJson } from './storage';

export type AuditAction =
  | 'invoice.created'
  | 'invoice.edited'
  | 'invoice.status'
  | 'invoice.deleted'
  | 'invoice.restored'
  | 'invoice.imported'
  | 'kpo.added'
  | 'kpo.edited'
  | 'kpo.deleted'
  | 'kpo.imported'
  | 'profile.edited';

export type AuditEntry = { at: string; who: string; action: AuditAction; target: string; detail?: string };

const MAX_ENTRIES = 3000;
const FOLD_MS = 10 * 60_000;

export const auditKey = (firmId = readFirms().activeId) => firmKey('studio.audit.v1', firmId);

export const readAudit = (firmId?: string): AuditEntry[] => {
  try {
    const value = JSON.parse(readRaw(auditKey(firmId)) ?? '[]');
    return Array.isArray(value) ? (value as AuditEntry[]) : [];
  } catch {
    return [];
  }
};

/** Who is working: the cloud account, else the name on the app lock. */
const currentUser = () => getCloudState().email ?? readLock()?.name ?? '';

/** Adds an entry, folding repeated edits of the same thing. Pure, for tests. */
export const appendAudit = (entries: AuditEntry[], entry: AuditEntry): AuditEntry[] => {
  const last = entries[entries.length - 1];
  const foldable = entry.action === 'invoice.edited' || entry.action === 'profile.edited' || entry.action === 'kpo.edited';
  if (
    foldable &&
    last &&
    last.action === entry.action &&
    last.target === entry.target &&
    last.who === entry.who &&
    new Date(entry.at).getTime() - new Date(last.at).getTime() < FOLD_MS
  ) {
    return [...entries.slice(0, -1), { ...last, at: entry.at }];
  }
  return [...entries, entry].slice(-MAX_ENTRIES);
};

export const logAudit = (action: AuditAction, target: string, detail?: string) => {
  // Viewers cannot change a shared firm: the stores refuse the change, and this tells the user why.
  const registry = readFirms();
  if (registry.firms.find((firm) => firm.id === registry.activeId)?.role === 'viewer') {
    window.dispatchEvent(new Event('read-only'));
    return;
  }
  try {
    const next = appendAudit(readAudit(), { at: new Date().toISOString(), who: currentUser(), action, target, ...(detail ? { detail } : {}) });
    writeJson(auditKey(), next);
  } catch {
    // History is best effort; the data itself is saved separately.
  }
};
