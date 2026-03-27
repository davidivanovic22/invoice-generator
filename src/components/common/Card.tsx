import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  className?: string;
}>;

export const Card = ({ children, className = '' }: Props) => {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-soft ${className}`}
    >
      {children}
    </section>
  );
};