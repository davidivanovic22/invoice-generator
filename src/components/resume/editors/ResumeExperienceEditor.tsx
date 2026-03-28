import type { ResumeExperienceItem } from '../../../types/resume';
import { AccordionSection } from '../../common/AcordionSection';

type Props = {
  items: ResumeExperienceItem[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<ResumeExperienceItem>) => void;
  onRemove: (id: string) => void;
  isOpen: boolean;
  onToggle: (id: string) => void;
};

export const ResumeExperienceEditor = ({
  items,
  onAdd,
  onChange,
  onRemove,
  isOpen,
  onToggle
}: Props) => {
  return (
    <AccordionSection
      id="employment"
      title="Employment"
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
              Position {index + 1}
            </div>

            <div className="space-y-3">
              <input
                value={item.role}
                onChange={(e) => onChange(item.id, { role: e.target.value })}
                placeholder="Job title"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              />

              <input
                value={item.company}
                onChange={(e) => onChange(item.id, { company: e.target.value })}
                placeholder="Company"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              />

              <input
                value={item.project ?? ''}
                onChange={(e) => onChange(item.id, { project: e.target.value })}
                placeholder="Project / department"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              />

              <input
                value={item.location ?? ''}
                onChange={(e) => onChange(item.id, { location: e.target.value })}
                placeholder="Location"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  value={item.start}
                  onChange={(e) => onChange(item.id, { start: e.target.value })}
                  placeholder="Start date"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                />
                <input
                  value={item.end}
                  onChange={(e) => onChange(item.id, { end: e.target.value })}
                  placeholder="End date / Present"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Bullet points
                </div>

                {item.bullets.map((bullet, bulletIndex) => (
                  <div key={bulletIndex} className="flex gap-2">
                    <input
                      value={bullet}
                      onChange={(e) => {
                        const nextBullets = [...item.bullets];
                        nextBullets[bulletIndex] = e.target.value;
                        onChange(item.id, { bullets: nextBullets });
                      }}
                      placeholder="Describe impact / responsibility"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextBullets = item.bullets.filter(
                          (_, currentIndex) => currentIndex !== bulletIndex
                        );
                        onChange(item.id, { bullets: nextBullets });
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    onChange(item.id, {
                      bullets: [...item.bullets, '']
                    })
                  }
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  Add bullet
                </button>
              </div>

              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
              >
                Remove position
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
        >
          Add employment
        </button>
      </div>
    </AccordionSection>
  );
};