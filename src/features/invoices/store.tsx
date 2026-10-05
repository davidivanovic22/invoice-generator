import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { writeJson } from '../../lib/storage';
import { createId } from '../../lib/files';
import { DocHistory } from '../../lib/history';
import { todayIso } from '../../lib/dates';
import { loadInvoiceStore, migrateLegacy, normalizeStore, STORE_KEY } from './migrate';
import {
  createInvoice,
  duplicateInvoice,
  generateRecurring,
  sameClient,
  type BusinessProfile,
  type Client,
  type Invoice,
  type InvoiceStatus,
  type InvoiceStore,
  type Party
} from './model';

type Updater<T> = Partial<T> | ((current: T) => T);
const apply = <T,>(current: T, update: Updater<T>): T =>
  typeof update === 'function' ? (update as (value: T) => T)(current) : { ...current, ...update };

export type ImportSummary = { added: number; skipped: number };

type InvoiceStoreValue = {
  store: InvoiceStore;
  createInvoice: (overrides?: Partial<Invoice>) => Invoice;
  duplicateInvoice: (id: string) => Invoice | null;
  /** `record: false` skips undo history (for bookkeeping such as linking a client). */
  updateInvoice: (id: string, update: Updater<Invoice>, options?: { record?: boolean }) => void;
  /** Removes an invoice and returns it, so the caller can offer Undo. */
  deleteInvoice: (id: string) => Invoice | undefined;
  /** Puts a deleted invoice back. */
  restoreInvoice: (invoice: Invoice) => void;
  undo: (id: string) => void;
  redo: (id: string) => void;
  canUndo: (id: string) => boolean;
  canRedo: (id: string) => boolean;
  setStatus: (id: string, status: InvoiceStatus) => void;
  updateProfile: (update: Updater<BusinessProfile>) => void;
  /** Saves (or refreshes) a client in the address book and returns its id. */
  rememberClient: (party: Party, currency: string, preferId?: string | null) => string | null;
  deleteClient: (id: string) => void;
  importBackup: (data: unknown) => ImportSummary;
  /** Creates the drafts of recurring invoices that are due and returns them. */
  runRecurring: () => Invoice[];
};

const Context = createContext<InvoiceStoreValue | null>(null);

export const useInvoiceStore = () => {
  const value = useContext(Context);
  if (!value) throw new Error('useInvoiceStore must be used inside <InvoiceStoreProvider>');
  return value;
};

/** `storageKey` selects the firm; the provider is remounted when the firm changes. */
export const InvoiceStoreProvider = ({ children, storageKey = STORE_KEY }: { children: ReactNode; storageKey?: string }) => {
  const [{ initial, persist }] = useState(() => {
    const loaded = loadInvoiceStore(storageKey);
    return { initial: loaded.store, persist: loaded.persist };
  });
  const [store, setStore] = useState<InvoiceStore>(initial);
  const storeRef = useRef(store);
  storeRef.current = store;

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!persist) return;
    const timer = setTimeout(() => writeJson(storageKey, store), 250);
    return () => clearTimeout(timer);
  }, [store, persist, storageKey]);

  // Flush pending changes if the tab closes inside the debounce window.
  useEffect(() => {
    if (!persist) return;
    const flush = () => writeJson(storageKey, storeRef.current);
    window.addEventListener('beforeunload', flush);
    // Also when switching firms, which unmounts this provider.
    return () => {
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [persist, storageKey]);

  const touch = (invoice: Invoice): Invoice => ({ ...invoice, updatedAt: new Date().toISOString() });

  const createInvoiceAction = useCallback((overrides?: Partial<Invoice>) => {
    const invoice = createInvoice(storeRef.current, overrides);
    setStore((current) => ({ ...current, invoices: [invoice, ...current.invoices] }));
    return invoice;
  }, []);

  const duplicateInvoiceAction = useCallback((id: string) => {
    const source = storeRef.current.invoices.find((invoice) => invoice.id === id);
    if (!source) return null;
    const copy = duplicateInvoice(storeRef.current, source);
    setStore((current) => ({ ...current, invoices: [copy, ...current.invoices] }));
    return copy;
  }, []);

  const history = useRef(new DocHistory<Invoice>()).current;

  const updateInvoice = useCallback((id: string, update: Updater<Invoice>, options?: { record?: boolean }) => {
    const before = storeRef.current.invoices.find((invoice) => invoice.id === id);
    if (before && options?.record !== false) history.record(id, before);
    setStore((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) => (invoice.id === id ? touch(apply(invoice, update)) : invoice))
    }));
  }, [history]);

  const deleteInvoice = useCallback((id: string) => {
    const removed = storeRef.current.invoices.find((invoice) => invoice.id === id);
    setStore((current) => ({ ...current, invoices: current.invoices.filter((invoice) => invoice.id !== id) }));
    return removed;
  }, []);

  const restoreInvoice = useCallback((invoice: Invoice) => {
    setStore((current) => (current.invoices.some((item) => item.id === invoice.id) ? current : { ...current, invoices: [invoice, ...current.invoices] }));
  }, []);

  const replace = useCallback((invoice: Invoice) => {
    setStore((current) => ({ ...current, invoices: current.invoices.map((item) => (item.id === invoice.id ? invoice : item)) }));
  }, []);

  const undo = useCallback(
    (id: string) => {
      const current = storeRef.current.invoices.find((invoice) => invoice.id === id);
      const previous = current && history.undo(id, current);
      if (previous) replace(previous);
    },
    [history, replace]
  );

  const redo = useCallback(
    (id: string) => {
      const current = storeRef.current.invoices.find((invoice) => invoice.id === id);
      const next = current && history.redo(id, current);
      if (next) replace(next);
    },
    [history, replace]
  );

  const canUndo = useCallback((id: string) => history.canUndo(id), [history]);
  const canRedo = useCallback((id: string) => history.canRedo(id), [history]);

  const setStatus = useCallback(
    (id: string, status: InvoiceStatus) =>
      updateInvoice(id, (invoice) => ({ ...invoice, status, paidAt: status === 'paid' ? invoice.paidAt ?? todayIso() : null })),
    [updateInvoice]
  );

  const updateProfile = useCallback((update: Updater<BusinessProfile>) => {
    setStore((current) => ({ ...current, profile: apply(current.profile, update) }));
  }, []);

  const rememberClient = useCallback((party: Party, currency: string, preferId?: string | null) => {
    if (!party.name.trim()) return null;
    const clients = storeRef.current.clients;
    // Prefer the record this invoice is linked to, so editing a client's name renames it instead of duplicating it.
    const existing =
      clients.find((client) => sameClient(client.party, party)) ?? clients.find((client) => client.id === preferId);
    const id = existing?.id ?? createId();
    const record: Client = { id, party: { ...party }, currency, lastUsedAt: new Date().toISOString() };
    setStore((current) => ({
      ...current,
      clients: existing
        ? current.clients.map((client) => (client.id === id ? record : client))
        : [record, ...current.clients]
    }));
    return id;
  }, []);

  const deleteClient = useCallback((id: string) => {
    setStore((current) => ({ ...current, clients: current.clients.filter((client) => client.id !== id) }));
  }, []);

  /** Merges a backup: never deletes or overwrites existing invoices. */
  const importBackup = useCallback((data: unknown): ImportSummary => {
    if (!data || typeof data !== 'object') throw new Error('This file is not an invoice backup.');
    const record = data as Record<string, unknown>;
    let incoming: InvoiceStore;
    if (record.version === 2 && Array.isArray(record.invoices)) {
      incoming = normalizeStore(record as Partial<InvoiceStore>);
    } else if (Array.isArray(record.invoices)) {
      incoming = migrateLegacy(record as Parameters<typeof migrateLegacy>[0]);
    } else if (typeof record.invoiceNumber === 'string' || Array.isArray(record.items)) {
      incoming = migrateLegacy({ invoices: [record] });
    } else {
      throw new Error('This file is not an invoice backup.');
    }

    const current = storeRef.current;
    const knownIds = new Set(current.invoices.map((invoice) => invoice.id));
    const fresh = incoming.invoices.filter((invoice) => !knownIds.has(invoice.id));
    const newClients = incoming.clients.filter(
      (client) => !current.clients.some((existing) => sameClient(existing.party, client.party))
    );
    setStore({
      ...current,
      invoices: [...fresh, ...current.invoices],
      clients: [...current.clients, ...newClients],
      profile: current.profile.party.name ? current.profile : incoming.profile
    });
    return { added: fresh.length, skipped: incoming.invoices.length - fresh.length };
  }, []);

  const runRecurring = useCallback(() => {
    const { store: next, created } = generateRecurring(storeRef.current);
    if (created.length) {
      storeRef.current = next;
      setStore(next);
    }
    return created;
  }, []);

  const value = useMemo<InvoiceStoreValue>(
    () => ({
      store,
      createInvoice: createInvoiceAction,
      duplicateInvoice: duplicateInvoiceAction,
      updateInvoice,
      deleteInvoice,
      restoreInvoice,
      undo,
      redo,
      canUndo,
      canRedo,
      setStatus,
      updateProfile,
      rememberClient,
      deleteClient,
      importBackup,
      runRecurring
    }),
    [store, createInvoiceAction, duplicateInvoiceAction, updateInvoice, deleteInvoice, restoreInvoice, undo, redo, canUndo, canRedo, setStatus, updateProfile, rememberClient, deleteClient, importBackup, runRecurring]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
};
