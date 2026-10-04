import { A4Thumbnail } from '../../../ui/A4Preview';
import { Section, Segmented, Swatches } from '../../../ui/Layout';
import { FONT_LABELS } from '../document/blocks';
import { ResumeDocument } from '../document/ResumeDocument';
import { RESUME_TEMPLATES } from '../document/templates';
import type { Resume, ResumeDensity, ResumeDesign, ResumeFont, ResumeTemplateId } from '../model';

export const DesignPanel = ({ resume, onChange }: { resume: Resume; onChange: (design: ResumeDesign) => void }) => {
  const design = resume.design;
  const set = (patch: Partial<ResumeDesign>) => onChange({ ...design, ...patch });
  return (
    <Section id="design" title="Design" icon="palette" description={`${RESUME_TEMPLATES[design.template].name} · ${FONT_LABELS[design.font]}`}>
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(RESUME_TEMPLATES) as ResumeTemplateId[]).map((id) => {
          const active = id === design.template;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => set({ template: id, font: RESUME_TEMPLATES[id].font })}
              className="group text-left"
              title={RESUME_TEMPLATES[id].description}
            >
              <div className={`overflow-hidden rounded-lg bg-white ring-2 transition ${active ? 'ring-indigo-500' : 'ring-slate-200 group-hover:ring-slate-300'}`}>
                <A4Thumbnail width={140}>
                  <ResumeDocument resume={{ ...resume, design: { ...design, template: id, font: RESUME_TEMPLATES[id].font } }} />
                </A4Thumbnail>
              </div>
              <div className={`mt-1.5 text-xs font-medium ${active ? 'text-indigo-700' : 'text-slate-700'}`}>{RESUME_TEMPLATES[id].name}</div>
              <div className="text-[11px] leading-tight text-slate-500">{RESUME_TEMPLATES[id].description}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-slate-700">Accent colour</div>
          <Swatches value={design.accentColor} onChange={(accentColor) => set({ accentColor })} />
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-slate-700">Font</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FONT_LABELS) as ResumeFont[]).map((font) => (
              <button
                key={font}
                type="button"
                aria-pressed={design.font === font}
                onClick={() => set({ font })}
                className={`rounded-lg px-3 py-1.5 text-[13px] ring-1 ring-inset transition ${
                  design.font === font ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300'
                }`}
                style={{ fontFamily: { sans: 'Inter', dm: 'DM Sans', grotesk: 'Space Grotesk', serif: 'Source Serif 4', elegant: 'Playfair Display' }[font] }}
              >
                {FONT_LABELS[font]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-slate-700">Spacing</div>
            <Segmented<ResumeDensity>
              value={design.density}
              onChange={(density) => set({ density })}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'normal', label: 'Normal' },
                { value: 'relaxed', label: 'Relaxed' }
              ]}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-1.5 text-[13px] font-medium text-slate-700">
            <input type="checkbox" checked={design.showPhoto} onChange={(event) => set({ showPhoto: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            Show photo
          </label>
        </div>
      </div>
    </Section>
  );
};
