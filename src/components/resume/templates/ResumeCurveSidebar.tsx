import type { ReactNode } from 'react';
import { ResumeData } from '../../../types/resume';
import { ResumeContactListBlock } from '../blocks/ResumeContactListBlock';
import { ResumeLanguageListBlock } from '../blocks/ResumeLanguageListBlock';
import { ResumePhotoBlock } from '../blocks/ResumePhotoBlock';
import { ResumeSectionTitleBlock } from '../blocks/ResumeSectionTitleBlock';
import {
  ResumeDotPercentageRatings,
  ResumeEducationList,
  ResumeExperienceList,
  ResumeFooterText,
  ResumeReferencesList,
  ResumeSkillGrid,
  ResumeStringSection,
  ResumeSummary
} from './ResumeBlocks';
import { resumePaperClassName, resumePaperStyle } from './shared';

type Props = {
  resume: ResumeData;
  isPdf?: boolean;
  pageIndex?: number;
};

type PageSection = {
  key: string;
  estimatedHeight: number;
  content: ReactNode;
};

type ResumePage = {
  sidebarSections: PageSection[];
  mainSections: PageSection[];
};

const PAGE_HEIGHT = 1123;
const DEFAULT_USABLE_HEIGHT = 1095;
const RELAXED_USABLE_HEIGHT = 1140;

const getVisibleSkills = (resume: ResumeData) =>
  resume.skills
    .filter((skill) => (skill.name ?? '').trim().length > 0 && (skill.percent ?? 0) > 0)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
    .slice(0, 6);

const getVisibleLanguages = (resume: ResumeData) =>
  resume.languages.filter((item) =>
    Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

const getVisibleQualities = (resume: ResumeData) =>
  resume.qualities.filter(
    (item) => (item.name ?? '').trim().length > 0 && (item.percent ?? 0) > 0
  );

const getVisibleReferences = (resume: ResumeData) =>
  resume.references.filter((item) =>
    Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

const getVisibleActivities = (resume: ResumeData) =>
  resume.extracurricularActivities.filter((item) => String(item ?? '').trim().length > 0);

const getVisibleEducation = (resume: ResumeData) =>
  resume.education.filter(
    (item) =>
      (item.school ?? '').trim().length > 0 ||
      (item.degree ?? '').trim().length > 0 ||
      (item.start ?? '').trim().length > 0 ||
      (item.end ?? '').trim().length > 0
  );

const getVisibleExperience = (resume: ResumeData) =>
  resume.experience.filter(
    (item) =>
      (item.role ?? '').trim().length > 0 ||
      (item.company ?? '').trim().length > 0 ||
      (item.project ?? '').trim().length > 0 ||
      (item.location ?? '').trim().length > 0 ||
      item.bullets.some((bullet) => bullet.trim().length > 0)
  );

const createSidebarSections = (
  resume: ResumeData,
  isPdf: boolean
): PageSection[] => {
  const visibleSkills = getVisibleSkills(resume);
  const visibleLanguages = getVisibleLanguages(resume);
  const visibleQualities = getVisibleQualities(resume);

  const sections: PageSection[] = [];

  sections.push({
    key: 'photo',
    estimatedHeight: 120,
    content: (
      <div className="flex justify-center">
        <div className="rounded-full border-[5px] border-white/70 p-1">
          <ResumePhotoBlock
            photo={resume.personal.photo}
            alt={resume.personal.fullName}
            rounded="rounded-full"
            sizeClassName="h-24 w-24"
            light
          />
        </div>
      </div>
    )
  });

  sections.push({
    key: 'contact',
    estimatedHeight: 130,
    content: (
      <div className="mt-9">
        <ResumeSectionTitleBlock accent="#ffffff" light>
          Contact
        </ResumeSectionTitleBlock>
        <ResumeContactListBlock resume={resume} light />
      </div>
    )
  });

  if (visibleSkills.length > 0) {
    sections.push({
      key: 'skills',
      estimatedHeight: 75 + Math.ceil(visibleSkills.length / 2) * 40,
      content: (
        <div className="mt-8">
          <ResumeSectionTitleBlock accent="#ffffff" light>
            Skills
          </ResumeSectionTitleBlock>
          <ResumeSkillGrid
            skills={visibleSkills}
            accent="#ffffff"
            light
            isPdf={isPdf}
            showPercent={false}
          />
        </div>
      )
    });
  }

  if (visibleLanguages.length > 0) {
    sections.push({
      key: 'languages',
      estimatedHeight: 55 + visibleLanguages.length * 36,
      content: (
        <div className="mt-8">
          <ResumeSectionTitleBlock accent="#ffffff" light>
            Languages
          </ResumeSectionTitleBlock>
          <ResumeLanguageListBlock resume={resume} light />
        </div>
      )
    });
  }

  if (resume.enabledSections.qualities && visibleQualities.length > 0) {
    sections.push({
      key: 'qualities',
      estimatedHeight: 55 + visibleQualities.length * 36,
      content: (
        <div className="mt-8">
          <ResumeDotPercentageRatings items={visibleQualities} accent="#ffffff" light />
        </div>
      )
    });
  }

  return sections;
};

const createMainSections = (
  resume: ResumeData,
  accent: string,
  isPdf: boolean
): PageSection[] => {
  const visibleEducation = getVisibleEducation(resume);
  const visibleExperience = getVisibleExperience(resume);
  const visibleReferences = getVisibleReferences(resume);
  const visibleActivities = getVisibleActivities(resume);

  const sections: PageSection[] = [];

  sections.push({
    key: 'header',
    estimatedHeight: 95,
    content: (
      <header>
        <h1 className="text-[31px] font-extrabold uppercase tracking-[0.18em] text-slate-900">
          {resume.personal.fullName}
        </h1>

        {resume.personal.title ? (
          <div
            className="mt-3 text-[16px] font-medium uppercase tracking-[0.22em]"
            style={{ color: accent }}
          >
            {resume.personal.title}
          </div>
        ) : null}
      </header>
    )
  });

  sections.push({
    key: 'summary',
    estimatedHeight: resume.professionalSummary ? 95 : 18,
    content: (
      <div className="mt-9">
        <ResumeSummary resume={resume} accent={accent} />
      </div>
    )
  });

  if (visibleEducation.length > 0) {
    sections.push({
      key: 'education',
      estimatedHeight: 90 + visibleEducation.length * 64,
      content: (
        <div className="mt-9">
          <ResumeEducationList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (visibleExperience.length > 0) {
    sections.push({
      key: 'experience',
      estimatedHeight:
        70 +
        visibleExperience.reduce((total, item) => {
          const bulletCount = item.bullets.filter((bullet) => bullet.trim().length > 0).length;
          return total + 72 + bulletCount * 18;
        }, 0),
      content: (
        <div className="mt-9">
          <ResumeExperienceList
            resume={resume}
            accent={accent}
            compact={false}
            isPdf={isPdf}
          />
        </div>
      )
    });
  }

  if (resume.enabledSections.references && visibleReferences.length > 0) {
    sections.push({
      key: 'references',
      estimatedHeight: 60 + visibleReferences.length * 52,
      content: (
        <div className="mt-9">
          <ResumeReferencesList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.extracurricularActivities && visibleActivities.length > 0) {
    sections.push({
      key: 'activities',
      estimatedHeight: 70 + visibleActivities.length * 34,
      content: (
        <div className="mt-9">
          <ResumeStringSection title="Activities" items={visibleActivities} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.footer && resume.footer) {
    sections.push({
      key: 'footer',
      estimatedHeight: 75,
      content: (
        <div className="mt-9">
          <ResumeFooterText title="Footer" value={resume.footer} accent={accent} />
        </div>
      )
    });
  }

  return sections;
};

const paginateSections = (
  sidebarSections: PageSection[],
  mainSections: PageSection[],
  usableHeight: number
): ResumePage[] => {
  const pages: ResumePage[] = [];
  let sidebarIndex = 0;
  let mainIndex = 0;

  while (sidebarIndex < sidebarSections.length || mainIndex < mainSections.length) {
    let sidebarUsed = 0;
    let mainUsed = 0;

    const pageSidebar: PageSection[] = [];
    const pageMain: PageSection[] = [];

    while (sidebarIndex < sidebarSections.length) {
      const section = sidebarSections[sidebarIndex];
      const nextHeight = sidebarUsed + section.estimatedHeight;

      if (pageSidebar.length > 0 && nextHeight > usableHeight) break;

      pageSidebar.push(section);
      sidebarUsed = nextHeight;
      sidebarIndex += 1;
    }

    while (mainIndex < mainSections.length) {
      const section = mainSections[mainIndex];
      const nextHeight = mainUsed + section.estimatedHeight;

      if (pageMain.length > 0 && nextHeight > usableHeight) break;

      pageMain.push(section);
      mainUsed = nextHeight;
      mainIndex += 1;
    }

    if (pageSidebar.length === 0 && sidebarIndex < sidebarSections.length) {
      pageSidebar.push(sidebarSections[sidebarIndex]);
      sidebarIndex += 1;
    }

    if (pageMain.length === 0 && mainIndex < mainSections.length) {
      pageMain.push(mainSections[mainIndex]);
      mainIndex += 1;
    }

    if (pageSidebar.length > 0 || pageMain.length > 0) {
      pages.push({
        sidebarSections: pageSidebar,
        mainSections: pageMain
      });
    } else {
      break;
    }
  }

  return pages;
};

export const buildCurveSidebarPages = (
  resume: ResumeData,
  isPdf = false
): ResumePage[] => {
  const accent = resume.editorSettings.accentColor || '#7c3f2c';
  const sidebarSections = createSidebarSections(resume, isPdf);
  const mainSections = createMainSections(resume, accent, isPdf);

  const defaultPages = paginateSections(sidebarSections, mainSections, DEFAULT_USABLE_HEIGHT);
  if (defaultPages.length === 1) return defaultPages;

  return paginateSections(sidebarSections, mainSections, RELAXED_USABLE_HEIGHT);
};

export const ResumeCurveSidebar = ({
  resume,
  isPdf = false,
  pageIndex
}: Props) => {
  const accent = resume.editorSettings.accentColor || '#7c3f2c';
  const pages = buildCurveSidebarPages(resume, isPdf);
  const visiblePages =
    typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

  return (
    <>
      {visiblePages.map((page, index) => (
        <div
          key={`resume-curve-sidebar-page-${index}`}
          className={`${resumePaperClassName} relative overflow-hidden rounded-none bg-white text-slate-900`}
          style={{
            ...resumePaperStyle,
            width: '794px',
            minHeight: `${PAGE_HEIGHT}px`,
            fontSize: `${resume.editorSettings.baseFontSize}px`,
            breakAfter: index === visiblePages.length - 1 ? 'auto' : 'page',
            pageBreakAfter: index === visiblePages.length - 1 ? 'auto' : 'always'
          }}
        >
          <div className="grid min-h-[1123px] grid-cols-[290px_1fr]">
            <aside className="relative overflow-hidden bg-[#1b2b47] px-6 pb-10 pt-9 text-white">
              <div
                className="absolute inset-y-[-80px] right-[-98px] w-[210px] rounded-l-[140px]"
                style={{ backgroundColor: accent }}
              />
              <div
                className="absolute inset-y-[120px] right-[-58px] w-[120px] rounded-l-[80px] opacity-35"
                style={{ backgroundColor: '#ffffff' }}
              />

              <div className="relative z-10">
                {page.sidebarSections.map((section) => (
                  <div key={section.key}>{section.content}</div>
                ))}
              </div>
            </aside>

            <main className="px-10 pb-10 pt-11">
              {page.mainSections.map((section) => (
                <div key={section.key}>{section.content}</div>
              ))}
            </main>
          </div>
        </div>
      ))}
    </>
  );
};