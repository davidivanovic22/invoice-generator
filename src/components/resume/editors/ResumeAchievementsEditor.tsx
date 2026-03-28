import type { ResumeAchievementItem } from '../../../types/resume';
import { AccordionSection } from '../../common/AcordionSection';

type Props = {
  items: ResumeAchievementItem[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<ResumeAchievementItem>) => void;
  onRemove: (id: string) => void;
  isOpen: boolean;
  onToggle: (id: string) => void;
};

export const ResumeAchievementsEditor = ({
  items,
  onAdd,
  onChange,
  onRemove,
  isOpen,
  onToggle
}: Props) => {
  return (
    <AccordionSection
      id="achievements"
      title="Achievements"
      isOpen={isOpen}
      onToggle={onToggle}
      badge={
        items.length ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {items.length}
          </span>
        ) : null
      }
    >
      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
          >
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Achievement {index + 1}
            </div>

            <div className="space-y-3">
              <input
                value={item.title}
                onChange={(e) => onChange(item.id, { title: e.target.value })}
                placeholder="Title"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              />

              <textarea
                value={item.description}
                onChange={(e) => onChange(item.id, { description: e.target.value })}
                placeholder="Description"
                className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              />

              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
              >
                Remove achievement
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
        >
          Add achievement
        </button>
      </div>
    </AccordionSection>
  );
};