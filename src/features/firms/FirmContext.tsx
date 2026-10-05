import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { addFirm, firmKey, readFirms, removeFirm, renameFirm, setActiveFirm, type Firm, type FirmBaseKey, type FirmRegistry } from '../../lib/firms';

type FirmContextValue = {
  registry: FirmRegistry;
  active: Firm;
  /** Storage key of the active firm for one kind of data. */
  keyFor: (base: FirmBaseKey) => string;
  switchFirm: (id: string) => void;
  createFirm: (name: string) => Firm;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
};

const FirmContext = createContext<FirmContextValue | null>(null);

export const useFirm = () => {
  const value = useContext(FirmContext);
  if (!value) throw new Error('useFirm must be used inside FirmProvider');
  return value;
};

export const FirmProvider = ({ children }: { children: ReactNode }) => {
  const [registry, setRegistry] = useState<FirmRegistry>(readFirms);
  const refresh = () => setRegistry(readFirms());

  const switchFirm = useCallback((id: string) => {
    setActiveFirm(id);
    setRegistry(readFirms());
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo<FirmContextValue>(() => {
    const active = registry.firms.find((firm) => firm.id === registry.activeId) ?? registry.firms[0];
    return {
      registry,
      active,
      keyFor: (base) => firmKey(base, active.id),
      switchFirm,
      createFirm: (name) => {
        const firm = addFirm(name);
        refresh();
        return firm;
      },
      rename: (id, name) => {
        renameFirm(id, name);
        refresh();
      },
      remove: (id) => {
        removeFirm(id);
        refresh();
      }
    };
  }, [registry, switchFirm]);

  return <FirmContext.Provider value={value}>{children}</FirmContext.Provider>;
};
