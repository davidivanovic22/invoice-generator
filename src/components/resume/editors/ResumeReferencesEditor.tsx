import type { ResumeReferenceItem } from '../../../types/resume';
import { AccordionSection } from '../../common/AcordionSection';

type Props = {
  items: ResumeReferenceItem[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<ResumeReferenceItem>) => void;
  onRemove: (id: string) => void;
  isOpen: boolean;
  onToggle: (id: string) => void;
};

export const ResumeReferencesEditor = ({
  items,
  onAdd,
  onChange,
  onRemove,
  isOpen,
  onToggle
}: Props) => {
  return (
    <AccordionSection
      id="references"
      title="References"
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
              Reference {index + 1}
            </div>

            <div className="space-y-3">
              <input
                value={item.name}
                onChange={(e) => onChange(item.id, { name: e.target.value })}
                placeholder="Name"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              />

              <input
                value={item.role}
                onChange={(e) => onChange(item.id, { role: e.target.value })}
                placeholder="Role"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              />

              <input
                value={item.company}
                onChange={(e) => onChange(item.id, { company: e.target.value })}
                placeholder="Company"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              />

              <input
                value={item.email}
                onChange={(e) => onChange(item.id, { email: e.target.value })}
                placeholder="Email"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              />

              <input
                value={item.phone}
                onChange={(e) => onChange(item.id, { phone: e.target.value })}
                placeholder="Phone"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              />

              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
              >
                Remove reference
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white"
        >
          Add reference
        </button>
      </div>
    </AccordionSection>
  );
};