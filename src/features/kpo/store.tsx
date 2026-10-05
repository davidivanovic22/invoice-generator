import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readJson, writeJson } from '../../lib/storage';
import { useInvoiceStore } from '../invoices/store';
import { createBook, createEntry, createHeader, DEFAULT_TEMPLATE, type KpoBook, type KpoEntry } from './model';

export const KPO_KEY = 'studio.kpo.v1';

type KpoContextValue = {
  book: KpoBook;
  update: (patch: Partial<KpoBook> | ((book: KpoBook) => KpoBook)) => void;
  addEntries: (entries: KpoEntry[]) => void;
  updateEntry: (id: string, patch: Partial<KpoEntry>) => void;
  removeEntry: (id: string) => KpoEntry | null;
  restoreEntry: (entry: KpoEntry) => void;
};

const KpoContext = createContext<KpoContextValue | null>(null);

export const normalizeBook = (raw: unknown): KpoBook => {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<KpoBook>;
  const base = createBook();
  return {
    version: 1,
    currency: value.currency === 'RSD' ? 'RSD' : 'EUR',
    header: { ...createHeader(), ...(value.header ?? {}) },
    entryTemplate: typeof value.entryTemplate === 'string' && value.entryTemplate ? value.entryTemplate : DEFAULT_TEMPLATE,
    bookOn: value.bookOn === 'issued' ? 'issued' : 'paid',
    entries: Array.isArray(value.entries)
      ? value.entries
          .filter((entry): entry is KpoEntry => Boolean(entry && typeof entry === 'object' && typeof (entry as KpoEntry).date === 'string'))
          .map((entry) => createEntry({ ...entry, products: Number(entry.products) || 0, services: Number(entry.services) || 0 }))
      : base.entries
  };
};

export const KpoStoreProvider = ({ children }: { children: ReactNode }) => {
  const { store } = useInvoiceStore();
  const [book, setBook] = useState<KpoBook>(() => {
    const saved = readJson<unknown>(KPO_KEY);
    return saved.status === 'ok' ? normalizeBook(saved.value) : createBook(store.profile.party);
  });
  const bookRef = useRef(book);
  bookRef.current = book;

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => writeJson(KPO_KEY, book), 250);
    return () => clearTimeout(timer);
  }, [book]);

  useEffect(() => {
    const flush = () => writeJson(KPO_KEY, bookRef.current);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  const update = useCallback((patch: Partial<KpoBook> | ((book: KpoBook) => KpoBook)) => {
    setBook((current) => (typeof patch === 'function' ? patch(current) : { ...current, ...patch }));
  }, []);

  const addEntries = useCallback((entries: KpoEntry[]) => setBook((current) => ({ ...current, entries: [...current.entries, ...entries] })), []);

  const updateEntry = useCallback(
    (id: string, patch: Partial<KpoEntry>) =>
      setBook((current) => ({ ...current, entries: current.entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)) })),
    []
  );

  const removeEntry = useCallback((id: string) => {
    const removed = bookRef.current.entries.find((entry) => entry.id === id) ?? null;
    setBook((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }));
    return removed;
  }, []);

  const restoreEntry = useCallback((entry: KpoEntry) => setBook((current) => ({ ...current, entries: [...current.entries, entry] })), []);

  const value = useMemo(() => ({ book, update, addEntries, updateEntry, removeEntry, restoreEntry }), [book, update, addEntries, updateEntry, removeEntry, restoreEntry]);
  return <KpoContext.Provider value={value}>{children}</KpoContext.Provider>;
};

export const useKpo = () => {
  const value = useContext(KpoContext);
  if (!value) throw new Error('useKpo must be used inside KpoStoreProvider');
  return value;
};
