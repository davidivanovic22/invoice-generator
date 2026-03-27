import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren & {
  isOpen: boolean;
  onToggle: () => void;
};

export const Sidebar = ({ children, isOpen, onToggle }: Props) => {
  return (
    <>
      {/* {!isOpen && (
        <button
          type="button"
          onClick={onToggle}
          className="fixed left-4 top-4 z-50 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
        >
          Open menu
        </button>
      )} */}

      <aside
        className={[
          'fixed left-0 top-0 z-40 h-screen border-r border-slate-200 bg-white transition-transform duration-300',
          'w-[280px] overflow-hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        ].join(' ')}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 p-5">
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
              Menu
            </div>

            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              Close
            </button>
          </div>

          <div className="h-full overflow-y-auto p-5">
            {children}
          </div>
        </div>
      </aside>
    </>
  );
};