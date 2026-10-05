/**
 * Several businesses in one app (an accountant's clients, or a second firm).
 *
 * Every firm keeps its own invoices and KPO book. The first firm ("default")
 * uses the original storage keys, so existing data needs no migration; other
 * firms use `<key>@<firmId>`. Resumes are personal and not tied to a firm.
 */
import { createId } from './files';

export const FIRMS_KEY = 'studio.firms';
export const DEFAULT_FIRM = 'default';
/** Storage keys that belong to a firm. */
export const FIRM_BASE_KEYS = ['studio.invoices.v2', 'studio.kpo.v1'] as const;
export type FirmBaseKey = (typeof FIRM_BASE_KEYS)[number];

export type Firm = { id: string; name: string; createdAt: string };
export type FirmRegistry = { firms: Firm[]; activeId: string };

const defaultRegistry = (): FirmRegistry => ({ firms: [{ id: DEFAULT_FIRM, name: '', createdAt: new Date().toISOString() }], activeId: DEFAULT_FIRM });

export const readFirms = (): FirmRegistry => {
  try {
    const value = JSON.parse(localStorage.getItem(FIRMS_KEY) ?? 'null') as FirmRegistry | null;
    if (!value || !Array.isArray(value.firms) || !value.firms.length) return defaultRegistry();
    const firms = value.firms.filter((firm) => firm && typeof firm.id === 'string');
    const activeId = firms.some((firm) => firm.id === value.activeId) ? value.activeId : firms[0].id;
    return { firms, activeId };
  } catch {
    return defaultRegistry();
  }
};

const writeFirms = (registry: FirmRegistry) => {
  try {
    localStorage.setItem(FIRMS_KEY, JSON.stringify(registry));
  } catch {
    // Firm list falls back to the default firm.
  }
};

export const firmKey = (base: FirmBaseKey, firmId: string) => (firmId === DEFAULT_FIRM ? base : `${base}@${firmId}`);

/** Every storage key that holds firm data, for backups and sync. */
export const allFirmKeys = (registry = readFirms()) => registry.firms.flatMap((firm) => FIRM_BASE_KEYS.map((base) => firmKey(base, firm.id)));

/** True for keys of any firm (also ones not in the registry yet, e.g. in a backup file). */
export const isFirmKey = (key: string) => FIRM_BASE_KEYS.some((base) => key === base || key.startsWith(`${base}@`));

export const setActiveFirm = (id: string) => {
  const registry = readFirms();
  if (registry.firms.some((firm) => firm.id === id)) writeFirms({ ...registry, activeId: id });
};

export const addFirm = (name: string): Firm => {
  const registry = readFirms();
  const firm: Firm = { id: createId().slice(0, 8), name: name.trim(), createdAt: new Date().toISOString() };
  writeFirms({ firms: [...registry.firms, firm], activeId: firm.id });
  return firm;
};

export const renameFirm = (id: string, name: string) => {
  const registry = readFirms();
  writeFirms({ ...registry, firms: registry.firms.map((firm) => (firm.id === id ? { ...firm, name: name.trim() } : firm)) });
};

/** Removes a firm and its data (callers take a backup snapshot first). The default firm is kept. */
export const removeFirm = (id: string) => {
  if (id === DEFAULT_FIRM) return;
  const registry = readFirms();
  for (const base of FIRM_BASE_KEYS) localStorage.removeItem(firmKey(base, id));
  const firms = registry.firms.filter((firm) => firm.id !== id);
  writeFirms({ firms, activeId: registry.activeId === id ? firms[0].id : registry.activeId });
};

/** The display name: the saved name, else the business name from the firm's profile. */
export const firmDisplayName = (firm: Firm) => {
  if (firm.name) return firm.name;
  try {
    const store = JSON.parse(localStorage.getItem(firmKey('studio.invoices.v2', firm.id)) ?? 'null');
    return String(store?.profile?.party?.name ?? '').trim();
  } catch {
    return '';
  }
};
