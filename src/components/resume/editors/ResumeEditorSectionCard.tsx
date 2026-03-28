import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  title: string;
}>;

export const ResumeEditorSectionCard = ({ title, children }: Props) => {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4">
      <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </div>
      {children}
    </div>
  );
};