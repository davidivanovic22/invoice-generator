import type { ReactNode } from 'react';

export type WizardStep = {
  id: string;
  label: string;
  icon: ReactNode;
  /** true when the step has meaningful content filled in — used to draw a checkmark. */
  isComplete: boolean;
};

type Props = {
  steps: WizardStep[];
  currentId: string;
  onSelect: (id: string) => void;
};

export const WizardStepper = ({ steps, currentId, onSelect }: Props) => {
  const currentIndex = steps.findIndex((step) => step.id === currentId);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-soft">
      <ol className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentId;
          const isPast = index < currentIndex;

          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                className={[
                  'flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition',
                  isCurrent
                    ? 'bg-slate-900 text-white'
                    : step.isComplete || isPast
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    isCurrent
                      ? 'bg-white text-slate-900'
                      : step.isComplete || isPast
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white text-slate-400'
                  ].join(' ')}
                >
                  {step.isComplete && !isCurrent ? '✓' : index + 1}
                </span>
                <span className="whitespace-nowrap">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
