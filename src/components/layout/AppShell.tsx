import type { PropsWithChildren } from 'react';

export const AppShell = ({ children }: PropsWithChildren) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100">
      {children}
    </div>
  );
};