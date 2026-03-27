import type { PropsWithChildren } from 'react';

export const Sidebar = ({ children }: PropsWithChildren) => {
  return (
    <aside className="print-hidden border-b border-slate-200 bg-white p-5 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
      {children}
    </aside>
  );
};