import { ResumeData } from '../../types/resume';
import { ResumeCenteredProfile } from './templates/ResumeCenteredProfile';
import { ResumeEditorialColumns } from './templates/ResumeEditorialColumns';
import { ResumeExecutiveSplit } from './templates/ResumeExecutiveSplit';
import { ResumeSidebarStacked } from './templates/ResumeSidebarStacked';
import { ResumeSoftAccentGrid } from './templates/ResumeSoftAccentGrid';
import { ResumeTopBanner } from './templates/ResumeTopBanner';

type Props = {
  resume: ResumeData;
  isPdf?: boolean;
};

export const ResumeTemplateRenderer = ({ resume, isPdf = false }: Props) => {
  switch (resume.editorSettings.template) {
    case 'sidebar-stacked':
      return <ResumeSidebarStacked resume={resume} />;
    case 'top-banner':
      return <ResumeTopBanner resume={resume} isPdf={isPdf}/>;
    case 'editorial-columns':
      return <ResumeEditorialColumns resume={resume} isPdf={isPdf}/>;
    case 'centered-profile':
      return <ResumeCenteredProfile resume={resume} isPdf={isPdf} />;
    case 'soft-accent-grid':
      return <ResumeSoftAccentGrid resume={resume}  isPdf={isPdf}/>;
    case 'executive-split':
    default:
      return <ResumeExecutiveSplit resume={resume} isPdf={isPdf} />;
  }
};