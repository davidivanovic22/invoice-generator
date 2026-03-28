import type { PropsWithChildren, ReactNode } from 'react';

type Props = PropsWithChildren<{
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  badge?: ReactNode;
}>;

export const AccordionSection = ({
  id,
  title,
  isOpen,
  onToggle,
  badge,
  children
}: Props) => {
  return (
    <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between px-4 py-4 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            {title}
          </div>
        </div>

        <div className="ml-3 flex items-center gap-2">
          {badge}
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500">
            {isOpen ? '-' : '+'}
          </div>
        </div>
      </button>

      {isOpen ? <div className="border-t border-slate-100 p-4">{children}</div> : null}
    </section>
  );
};