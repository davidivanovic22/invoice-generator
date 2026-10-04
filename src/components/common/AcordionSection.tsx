import type { PropsWithChildren, ReactNode } from 'react';

type Props = PropsWithChildren<{
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
  badge?: ReactNode;
  icon?: ReactNode;
  /** Short one-line preview shown under the title when the section is collapsed,
   * e.g. the issuer's name, or "3 items · €450". Helps users scan without opening every section. */
  summary?: ReactNode;
}>;

export const AccordionSection = ({
  id,
  title,
  isOpen,
  onToggle,
  badge,
  icon,
  summary,
  children
}: Props) => {
  return (
    <section
      className={[
        'overflow-hidden rounded-[22px] border bg-white shadow-sm transition-colors',
        isOpen ? 'border-slate-300' : 'border-slate-200'
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-3">
          {icon ? (
            <div
              className={[
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                isOpen ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
              ].join(' ')}
            >
              {icon}
            </div>
          ) : null}

          <div className="min-w-0">
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
              {title}
            </div>
            {!isOpen && summary ? (
              <div className="mt-0.5 truncate text-sm font-medium text-slate-700">{summary}</div>
            ) : null}
          </div>
        </div>

        <div className="ml-3 flex shrink-0 items-center gap-2">
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