import type { ResumeCustomSectionKey, ResumeData } from '../../../types/resume';
import { getDisabledSections, SECTION_LABELS } from '../../../utils/resumeFieldConfig';
import { ResumeAddChip } from './ResumeAddChip';

type Props = {
  resume: ResumeData;
  onEnableSection: (section: ResumeCustomSectionKey) => void;
};

export const ResumeAdditionalSectionsPanel = ({
  resume,
  onEnableSection
}: Props) => {
  const disabledSections = getDisabledSections(resume.enabledSections);

  if (disabledSections.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4">
      <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
        Additional sections
      </div>

      <div className="flex flex-wrap gap-2">
        {disabledSections.map((section) => (
          <ResumeAddChip
            key={section}
            label={SECTION_LABELS[section]}
            onClick={() => onEnableSection(section)}
          />
        ))}
      </div>
    </div>
  );
};