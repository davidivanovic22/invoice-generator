import { ResumeData, ResumeTemplateKey } from '../../types/resume';
import { ResumeTemplateRenderer } from './ResumeTemplateRenderer';

const templates: ResumeTemplateKey[] = [
  'executive-split',
  'sidebar-stacked',
  'top-banner',
  'editorial-columns',
  'centered-profile',
  'soft-accent-grid',
  'modern-minimal',
  'elegant-classic',
  'dark-pro',
  'creative-gradient',
  'tech-clean',
  'compact-pro'
];

type Props = {
  resume: ResumeData;
  selected: ResumeTemplateKey;
  onSelect: (template: ResumeTemplateKey) => void;
};

const templateLabels: Record<ResumeTemplateKey, string> = {
  'executive-split': 'Executive',
  'sidebar-stacked': 'Sidebar',
  'top-banner': 'Top Banner',
  'editorial-columns': 'Editorial',
  'centered-profile': 'Centered',
  'soft-accent-grid': 'Soft Accent',
  'modern-minimal': 'Minimal',
  'elegant-classic': 'Classic',
  'dark-pro': 'Dark Pro',
  'creative-gradient': 'Creative',
  'tech-clean': 'Tech',
  'compact-pro': 'Compact'
};

export const ResumeThemeRail = ({
  resume,
  selected,
  onSelect
}: Props) => {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <div className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">
          Templates
        </div>
        <div className="mt-1 text-sm text-slate-500">
          Choose a resume design
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {templates.map((template) => {
            const previewResume: ResumeData = {
              ...resume,
              editorSettings: {
                ...resume.editorSettings,
                template
              }
            };

            const isActive = template === selected;

            return (
              <button
                key={template}
                type="button"
                onClick={() => onSelect(template)}
                className={`group w-[150px] shrink-0 rounded-[18px] border bg-white text-left transition ${
                  isActive
                    ? 'border-slate-900 shadow-md'
                    : 'border-slate-200 hover:border-slate-400 hover:shadow-sm'
                }`}
              >
                <div className="relative p-2">
                  {isActive ? (
                    <div className="absolute right-3 top-3 z-10 rounded-full bg-slate-900 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white">
                      Active
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-slate-100">
                    <div
                      className="origin-top-left"
                      style={{
                        width: '794px',
                        height: '1123px',
                        transform: 'scale(0.16)',
                        transformOrigin: 'top left',
                        marginBottom: '-944px'
                      }}
                    >
                      <ResumeTemplateRenderer resume={previewResume} isPdf />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                  <div className="text-sm font-semibold text-slate-900">
                    {templateLabels[template]}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};