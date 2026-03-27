import type { PropsWithChildren } from 'react';

export const AppShell = ({ children }: PropsWithChildren) => {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[400px_minmax(0,1fr)]">
      {children}
    </div>
  );
};