import type { ComponentType } from 'react';
import type { ResumeData } from '../../types/resume';
import {
  ResumeArchedProfile,
  buildArchedProfilePages
} from './templates/ResumeArchedProfile';
import {
  ResumeCompactPro,
  buildCompactProPages
} from './templates/ResumeCompactPro';
import {
  ResumeCreativeGradient,
  buildCreativeGradientPages
} from './templates/ResumeCreativeGradient';
import {
  ResumeCurveSidebar,
  buildCurveSidebarPages
} from './templates/ResumeCurveSidebar';
import {
  ResumeDarkPro,
  buildDarkProPages
} from './templates/ResumeDarkPro';
import {
  ResumeEditorialColumns,
  buildEditorialColumnsPages
} from './templates/ResumeEditorialColumns';
import {
  ResumeElegantClassic,
  buildElegantClassicPages
} from './templates/ResumeElegantClassic';
import {
  ResumeExecutiveSplit,
  buildExecutiveSplitPages
} from './templates/ResumeExecutiveSplit';
import {
  ResumeInfographicSplit,
  buildInfographicSplitPages
} from './templates/ResumeInfographicSplit';
import {
  ResumeModernMinimal,
  buildModernMinimalPages
} from './templates/ResumeModernMinimal';
import {
  ResumeSidebarStacked,
  buildSidebarStackedPages
} from './templates/ResumeSidebarStacked';
import {
  ResumeSoftAccentGrid,
  buildSoftAccentGridPages
} from './templates/ResumeSoftAccentGrid';
import {
  ResumeTechClean,
  buildTechCleanPages
} from './templates/ResumeTechClean';
import {
  ResumeTopBanner,
  buildTopBannerPages
} from './templates/ResumeTopBanner';
import { buildPremiumGoldenPages, ResumePremiumGolden } from './templates/ResumePremiumGolden';
import { buildPremiumClassicPages, ResumePremiumClassic } from './templates/ResumePremiumClassic';
import { buildMinimalClassicBlockPages, ResumeMinimalClassicBlock } from './templates/ResumeMinimalClassicBlock';
import { ResumeExecutiveSlate, buildExecutiveSlatePages } from './templates/ResumeExecutiveSlate';
import { ResumeModernRibbon, buildModernRibbonPages } from './templates/ResumeModernRibbon';
import { ResumeRoundedCardProfile, buildRoundedCardProfilePages } from './templates/ResumeRoundedCardProfile';

export type ResumeTemplateProps = {
  resume: ResumeData;
  isPdf?: boolean;
  pageIndex?: number;
};

type Props = ResumeTemplateProps;

type TemplateConfig = {
  component: ComponentType<ResumeTemplateProps>;
  buildPages?: (resume: ResumeData, isPdf?: boolean) => unknown[];
};

const TEMPLATE_REGISTRY: Record<string, TemplateConfig> = {
  'executive-split': {
    component: ResumeExecutiveSplit,
    buildPages: buildExecutiveSplitPages
  },
  'top-banner': {
    component: ResumeTopBanner,
    buildPages: buildTopBannerPages
  },
  'cv-arched-profile': {
    component: ResumeArchedProfile,
    buildPages: buildArchedProfilePages
  },
  'cv-infographic-split': {
    component: ResumeInfographicSplit,
    buildPages: buildInfographicSplitPages
  },
  'elegant-classic': {
    component: ResumeElegantClassic,
    buildPages: buildElegantClassicPages
  },
  'tech-clean': {
    component: ResumeTechClean,
    buildPages: buildTechCleanPages
  },
  'editorial-columns': {
    component: ResumeEditorialColumns,
    buildPages: buildEditorialColumnsPages
  },
  'modern-minimal': {
    component: ResumeModernMinimal,
    buildPages: buildModernMinimalPages
  },
  'dark-pro': {
    component: ResumeDarkPro,
    buildPages: buildDarkProPages
  },
  'creative-gradient': {
    component: ResumeCreativeGradient,
    buildPages: buildCreativeGradientPages
  },
  'cv-curve-sidebar': {
    component: ResumeCurveSidebar,
    buildPages: buildCurveSidebarPages
  },
  'soft-accent-grid': {
    component: ResumeSoftAccentGrid,
    buildPages: buildSoftAccentGridPages
  },
  'sidebar-stacked': {
    component: ResumeSidebarStacked,
    buildPages: buildSidebarStackedPages
  },
  'compact-pro': {
    component: ResumeCompactPro,
    buildPages: buildCompactProPages
  },
  'premium-golden': {
    component: ResumePremiumGolden,
    buildPages: buildPremiumGoldenPages
  },
  'premium-classic': {
    component: ResumePremiumClassic,
    buildPages: buildPremiumClassicPages
  },
  'modern-ribbon': {
    component: ResumeModernRibbon,
    buildPages: buildModernRibbonPages
  },
  'executive-slate': {
    component: ResumeExecutiveSlate,
    buildPages: buildExecutiveSlatePages
  },
  'rounded-card-profile': {
    component: ResumeRoundedCardProfile,
    buildPages: buildRoundedCardProfilePages
  },
  'minimal-classic-block': {
    component: ResumeMinimalClassicBlock,
    buildPages: buildMinimalClassicBlockPages 
  }
};

const DEFAULT_TEMPLATE_KEY = 'top-banner';

const getTemplateConfig = (template?: string): TemplateConfig => {
  if (!template) {
    return TEMPLATE_REGISTRY[DEFAULT_TEMPLATE_KEY];
  }

  return TEMPLATE_REGISTRY[template] ?? TEMPLATE_REGISTRY[DEFAULT_TEMPLATE_KEY];
};

export const getResumeTemplatePageCount = (
  resume: ResumeData,
  isPdf = false
): number => {
  const config = getTemplateConfig(resume.editorSettings.template);

  if (!config.buildPages) {
    return 1;
  }

  const pages = config.buildPages(resume, isPdf);
  return pages.length || 1;
};

export const ResumeTemplateRenderer = ({
  resume,
  isPdf = false,
  pageIndex
}: Props) => {
  const { component: TemplateComponent } = getTemplateConfig(
    resume.editorSettings.template
  );

  return (
    <TemplateComponent
      resume={resume}
      isPdf={isPdf}
      pageIndex={pageIndex}
    />
  );
};