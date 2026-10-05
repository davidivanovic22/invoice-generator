import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n';
import { firmDisplayName } from '../../lib/firms';
import { Icon } from '../../ui/Icon';
import { useInvoiceStore } from '../invoices/store';
import { useFirm } from './FirmContext';
import { NewFirmDialog } from './FirmsPage';

/** The active firm in the header; switch firms, open the firm list or add one. */
export const FirmSwitcher = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { registry, active, switchFirm } = useFirm();
  const { store } = useInvoiceStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => !rootRef.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const nameOf = (id: string) => {
    const firm = registry.firms.find((item) => item.id === id)!;
    return (id === active.id ? firm.name || store.profile.party.name : firmDisplayName(firm)) || t('My firm');
  };

  const go = (to: string) => {
    setOpen(false);
    onNavigate?.();
    navigate(to);
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('Switch firm')}
        className="flex max-w-[200px] items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold uppercase text-indigo-700">{nameOf(active.id).slice(0, 1)}</span>
        <span className="truncate">{nameOf(active.id)}</span>
        <Icon name="chevronDown" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 z-40 mt-1 w-64 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('Firms')}</div>
          {registry.firms.map((firm) => (
            <button
              key={firm.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
                switchFirm(firm.id);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="min-w-0 flex-1 truncate">{nameOf(firm.id)}</span>
              {firm.id === active.id && <Icon name="check" className="h-4 w-4 text-indigo-600" />}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <button type="button" role="menuitem" onClick={() => go('/firms')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
            <Icon name="list" className="h-4 w-4 text-slate-400" />
            {t('All firms')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setCreating(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-slate-50"
          >
            <Icon name="plus" className="h-4 w-4" />
            {t('New firm')}
          </button>
        </div>
      )}
      {creating && <NewFirmDialog onClose={() => setCreating(false)} />}
    </div>
  );
};
