import type { PropsWithChildren } from 'react';

export const MainContent = ({ children }: PropsWithChildren) => {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      {children}
    </main>
  );
};