import type { PropsWithChildren, ReactNode } from 'react';

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
  stepNumber: number;
  totalSteps: number;
  onPrev?: () => void;
  onNext?: () => void;
  nextLabel?: ReactNode;
}>;

export const WizardStepShell = ({
  title,
  subtitle,
  stepNumber,
  totalSteps,
  onPrev,
  onNext,
  nextLabel,
  children
}: Props) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Step {stepNumber} of {totalSteps}
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>

      <div>{children}</div>

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={!onPrev}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-0"
        >
          ← Back
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-0"
        >
          {nextLabel ?? 'Next →'}
        </button>
      </div>
    </div>
  );
};
