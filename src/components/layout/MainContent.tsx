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
        'flex h-screen min-h-0 flex-col transition-all duration-300',
        // Sidebar is `position: fixed`, so it takes no space in this flex
        // row — `flex-1` alone would size main to the full row width and
        // then shove it right with the margin, overflowing past the
        // viewport. Pin the width explicitly to match the margin instead.
        isSidebarOpen ? 'ml-[280px] w-[calc(100%-280px)]' : 'ml-0 w-full'
      ].join(' ')}
    >
      <div className="z-30 flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-100/90 px-6 py-4 backdrop-blur">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          {isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        </button>
      </div>

      {/* Pages that need independently-scrolling panes (e.g. the invoice
          editor's step list vs. its A4 preview) size themselves to this
          area and manage their own overflow; everything else just scrolls
          here as a single column, same as before. */}
      <div className="min-w-0 min-h-0 flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </main>
  );
};