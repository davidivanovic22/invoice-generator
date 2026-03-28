import { ResumeData } from '../../types/resume';
import { ResumeCenteredProfile } from './templates/ResumeCenteredProfile';
import { ResumeCompactPro } from './templates/ResumeCompactPro';
import { ResumeCreativeGradient } from './templates/ResumeCreativeGradient';
import { ResumeDarkPro } from './templates/ResumeDarkPro';
import { ResumeEditorialColumns } from './templates/ResumeEditorialColumns';
import { ResumeElegantClassic } from './templates/ResumeElegantClassic';
import { ResumeExecutiveSplit } from './templates/ResumeExecutiveSplit';
import { ResumeModernMinimal } from './templates/ResumeModernMinimal';
import { ResumeSidebarStacked } from './templates/ResumeSidebarStacked';
import { ResumeSoftAccentGrid } from './templates/ResumeSoftAccentGrid';
import { ResumeTechClean } from './templates/ResumeTechClean';
import { ResumeTopBanner } from './templates/ResumeTopBanner';

type Props = {
  resume: ResumeData;
  isPdf?: boolean;
};

export const ResumeTemplateRenderer = ({ resume, isPdf = false }: Props) => {
  switch (resume.editorSettings.template) {
    case 'sidebar-stacked':
      return <ResumeSidebarStacked resume={resume}  isPdf={isPdf}/>;
    case 'top-banner':
      return <ResumeTopBanner resume={resume} isPdf={isPdf} />;
    case 'editorial-columns':
      return <ResumeEditorialColumns resume={resume} isPdf={isPdf} />;
    case 'centered-profile':
      return <ResumeCenteredProfile resume={resume} isPdf={isPdf} />;
    case 'soft-accent-grid':
      return <ResumeSoftAccentGrid resume={resume} isPdf={isPdf} />;
    case 'executive-split':
    case 'modern-minimal':
      return <ResumeModernMinimal resume={resume} isPdf={isPdf}/>;
    case 'elegant-classic':
      return <ResumeElegantClassic resume={resume} isPdf={isPdf} />;
    case 'dark-pro':
      return <ResumeDarkPro resume={resume} isPdf={isPdf} />;
    case 'creative-gradient':
      return <ResumeCreativeGradient resume={resume} isPdf={isPdf} />;
    case 'tech-clean':
      return <ResumeTechClean resume={resume} isPdf={isPdf} />;
    case 'compact-pro':
      return <ResumeCompactPro resume={resume} isPdf={isPdf} />;
    default:
      return <ResumeExecutiveSplit resume={resume} isPdf={isPdf} />;
  }
};