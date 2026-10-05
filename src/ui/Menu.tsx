import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

export type MenuItem = { label: string; icon?: IconName; onSelect: () => void; danger?: boolean; disabled?: boolean } | 'divider';

/** A "⋯" button that opens a small action menu. Closes on outside click and Escape. */
export const Menu = ({ items, label, icon = 'more' }: { items: MenuItem[]; label: string; icon?: IconName }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
      >
        <Icon name={icon} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 min-w-[190px] overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
          {items.map((item, index) =>
            item === 'divider' ? (
              <div key={`divider-${index}`} className="my-1 border-t border-slate-100" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition disabled:opacity-40 ${
                  item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.icon && <Icon name={item.icon} className="h-4 w-4" />}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
