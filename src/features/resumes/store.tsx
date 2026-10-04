import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createId } from '../../lib/files';
import { writeJson } from '../../lib/storage';
import { loadResumeStore, migrateLegacyResume, normalizeResumeStore, RESUME_STORE_KEY } from './migrate';
import { createEmptyResume, createSampleResume, type Resume, type ResumeStore } from './model';

type Updater = Partial<Resume> | ((resume: Resume) => Resume);

type ResumeStoreValue = {
  store: ResumeStore;
  createResume: (kind: 'sample' | 'empty') => Resume;
  duplicateResume: (id: string) => Resume | null;
  updateResume: (id: string, update: Updater) => void;
  deleteResume: (id: string) => void;
  importBackup: (data: unknown) => number;
};

const Context = createContext<ResumeStoreValue | null>(null);

export const useResumeStore = () => {
  const value = useContext(Context);
  if (!value) throw new Error('useResumeStore must be used inside <ResumeStoreProvider>');
  return value;
};

/** Gives every nested item a fresh id so a copy never shares React keys with its source. */
const cloneWithNewIds = (resume: Resume): Resume => ({
  ...resume,
  id: createId(),
  personal: { ...resume.personal, extras: resume.personal.extras.map((extra) => ({ ...extra, id: createId() })) },
  sections: resume.sections.map((section) => {
    const base = { ...section, id: createId() };
    if (base.type === 'entries') return { ...base, items: base.items.map((item) => ({ ...item, id: createId() })) };
    if (base.type === 'languages') return { ...base, items: base.items.map((item) => ({ ...item, id: createId() })) };
    if (base.type === 'tags') return { ...base, items: [...base.items] };
    return base;
  })
});

export const ResumeStoreProvider = ({ children }: { children: ReactNode }) => {
  const [{ initial, persist }] = useState(() => {
    const loaded = loadResumeStore();
    return { initial: loaded.store, persist: loaded.persist };
  });
  const [store, setStore] = useState(initial);
  const storeRef = useRef(store);
  storeRef.current = store;

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!persist) return;
    const timer = setTimeout(() => writeJson(RESUME_STORE_KEY, store), 250);
    return () => clearTimeout(timer);
  }, [store, persist]);

  useEffect(() => {
    if (!persist) return;
    const flush = () => writeJson(RESUME_STORE_KEY, storeRef.current);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [persist]);

  const createResume = useCallback((kind: 'sample' | 'empty') => {
    const resume = kind === 'sample' ? createSampleResume() : createEmptyResume();
    setStore((current) => ({ ...current, resumes: [resume, ...current.resumes] }));
    return resume;
  }, []);

  const duplicateResume = useCallback((id: string) => {
    const source = storeRef.current.resumes.find((resume) => resume.id === id);
    if (!source) return null;
    const now = new Date().toISOString();
    const copy = { ...cloneWithNewIds(source), name: `${source.name} (copy)`, createdAt: now, updatedAt: now };
    setStore((current) => ({ ...current, resumes: [copy, ...current.resumes] }));
    return copy;
  }, []);

  const updateResume = useCallback((id: string, update: Updater) => {
    setStore((current) => ({
      ...current,
      resumes: current.resumes.map((resume) => {
        if (resume.id !== id) return resume;
        const next = typeof update === 'function' ? update(resume) : { ...resume, ...update };
        return { ...next, updatedAt: new Date().toISOString() };
      })
    }));
  }, []);

  const deleteResume = useCallback((id: string) => {
    setStore((current) => ({ ...current, resumes: current.resumes.filter((resume) => resume.id !== id) }));
  }, []);

  /** Adds resumes from a backup without touching existing ones; returns how many were added. */
  const importBackup = useCallback((data: unknown) => {
    if (!data || typeof data !== 'object') throw new Error('This file is not a resume backup.');
    const record = data as Record<string, unknown>;
    let incoming: Resume[];
    if (record.version === 2 && Array.isArray(record.resumes)) incoming = normalizeResumeStore(record as Partial<ResumeStore>).resumes;
    else if (Array.isArray(record.resumes)) incoming = (record.resumes as Record<string, unknown>[]).map(migrateLegacyResume);
    else if (record.personal && typeof record.personal === 'object') incoming = [migrateLegacyResume(record)];
    else throw new Error('This file is not a resume backup.');
    const known = new Set(storeRef.current.resumes.map((resume) => resume.id));
    const fresh = incoming.filter((resume) => !known.has(resume.id));
    setStore((current) => ({ ...current, resumes: [...fresh, ...current.resumes] }));
    return fresh.length;
  }, []);

  const value = useMemo(
    () => ({ store, createResume, duplicateResume, updateResume, deleteResume, importBackup }),
    [store, createResume, duplicateResume, updateResume, deleteResume, importBackup]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
};
