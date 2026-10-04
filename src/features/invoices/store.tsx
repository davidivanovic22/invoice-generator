import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { writeJson } from '../../lib/storage';
import { createId } from '../../lib/files';
import { todayIso } from '../../lib/dates';
import { loadInvoiceStore, migrateLegacy, normalizeStore, STORE_KEY } from './migrate';
import {
  createInvoice,
  duplicateInvoice,
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
  updateInvoice: (id: string, update: Updater<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  setStatus: (id: string, status: InvoiceStatus) => void;
  updateProfile: (update: Updater<BusinessProfile>) => void;
  /** Saves (or refreshes) a client in the address book and returns its id. */
  rememberClient: (party: Party, currency: string, preferId?: string | null) => string | null;
  deleteClient: (id: string) => void;
  importBackup: (data: unknown) => ImportSummary;
};

const Context = createContext<InvoiceStoreValue | null>(null);

export const useInvoiceStore = () => {
  const value = useContext(Context);
  if (!value) throw new Error('useInvoiceStore must be used inside <InvoiceStoreProvider>');
  return value;
};

export const InvoiceStoreProvider = ({ children }: { children: ReactNode }) => {
  const [{ initial, persist }] = useState(() => {
    const loaded = loadInvoiceStore();
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
    const timer = setTimeout(() => writeJson(STORE_KEY, store), 250);
    return () => clearTimeout(timer);
  }, [store, persist]);

  // Flush pending changes if the tab closes inside the debounce window.
  useEffect(() => {
    if (!persist) return;
    const flush = () => writeJson(STORE_KEY, storeRef.current);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [persist]);

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

  const updateInvoice = useCallback((id: string, update: Updater<Invoice>) => {
    setStore((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) => (invoice.id === id ? touch(apply(invoice, update)) : invoice))
    }));
  }, []);

  const deleteInvoice = useCallback((id: string) => {
    setStore((current) => ({ ...current, invoices: current.invoices.filter((invoice) => invoice.id !== id) }));
  }, []);

  const setStatus = useCallback(
    (id: string, status: InvoiceStatus) =>
      updateInvoice(id, (invoice) => ({ ...invoice, status, paidAt: status === 'paid' ? todayIso() : null })),
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

  const value = useMemo<InvoiceStoreValue>(
    () => ({
      store,
      createInvoice: createInvoiceAction,
      duplicateInvoice: duplicateInvoiceAction,
      updateInvoice,
      deleteInvoice,
      setStatus,
      updateProfile,
      rememberClient,
      deleteClient,
      importBackup
    }),
    [store, createInvoiceAction, duplicateInvoiceAction, updateInvoice, deleteInvoice, setStatus, updateProfile, rememberClient, deleteClient, importBackup]
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
};
