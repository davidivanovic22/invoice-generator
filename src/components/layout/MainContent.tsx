import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren & {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
};

export const MainContent = ({
  children,
  isSidebarOpen,
  onToggleSidebar
}: Props) => {
  return (
    <main
      className={[
        'h-screen flex-1 overflow-y-auto transition-all duration-300',
        isSidebarOpen ? 'ml-[280px]' : 'ml-0'
      ].join(' ')}
    >
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-slate-100/90 px-6 py-4 backdrop-blur">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          {isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        </button>
      </div>

      <div className="min-w-0 p-6">
        {children}
      </div>
    </main>
  );
};