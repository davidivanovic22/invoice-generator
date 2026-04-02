import type { ReactNode } from 'react';
import { ResumeData } from '../../../types/resume';
import { ResumeContactListBlock } from '../blocks/ResumeContactListBlock';
import { ResumeLanguageListBlock } from '../blocks/ResumeLanguageListBlock';
import { ResumePhotoBlock } from '../blocks/ResumePhotoBlock';
import { ResumeSectionTitleBlock } from '../blocks/ResumeSectionTitleBlock';
import {
  ResumeAchievementsList,
  ResumeEducationList,
  ResumeExperienceList,
  ResumeFooterText,
  ResumeSkillGrid,
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
const DEFAULT_USABLE_HEIGHT = 1030;
const RELAXED_USABLE_HEIGHT = 1080;

const CLASSIC_ACCENT = '#8a7458';

const createVisibleSkills = (resume: ResumeData) =>
  resume.skills
    .filter((skill) => (skill.name ?? '').trim().length > 0 && (skill.percent ?? 0) > 0)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
    .slice(0, 10);

const createVisibleExperience = (resume: ResumeData) =>
  resume.experience.filter(
    (item) =>
      (item.role ?? '').trim().length > 0 ||
      (item.company ?? '').trim().length > 0 ||
      (item.project ?? '').trim().length > 0 ||
      (item.location ?? '').trim().length > 0 ||
      item.bullets.some((bullet) => bullet.trim().length > 0)
  );

const createVisibleAchievements = (resume: ResumeData) =>
  resume.achievements.filter(
    (item) => (item.title ?? '').trim().length > 0 || (item.description ?? '').trim().length > 0
  );

const createSidebarHeader = (resume: ResumeData): PageSection => ({
  key: 'sidebar-header',
  estimatedHeight: 255,
  content: (
    <div className="text-center">
      <div className="mx-auto flex justify-center">
        <ResumePhotoBlock
          photo={resume.personal.photo}
          alt={resume.personal.fullName}
          rounded="rounded-full"
          sizeClassName="h-[170px] w-[170px]"
        />
      </div>

      <div className="mt-6 text-[11px] font-bold uppercase tracking-[0.32em] text-slate-400">
        Personal Profile
      </div>

      <div className="mx-auto mt-4 h-px w-24 bg-slate-300" />

      <h1 className="mt-6 text-[30px] font-light uppercase leading-tight tracking-[0.18em] text-slate-700">
        {resume.personal.fullName}
      </h1>

      <div className="mt-3 text-[14px] font-medium uppercase tracking-[0.18em] text-slate-500">
        {resume.personal.title}
      </div>
    </div>
  )
});

const createSidebarSections = (
  resume: ResumeData,
  accent: string,
  isPdf: boolean
): PageSection[] => {
  const visibleSkills = createVisibleSkills(resume);
  const sections: PageSection[] = [createSidebarHeader(resume)];

  sections.push({
    key: 'contact',
    estimatedHeight: 130,
    content: (
      <div className="mt-8">
        <ResumeSectionTitleBlock accent={accent}>Contact</ResumeSectionTitleBlock>
        <ResumeContactListBlock resume={resume} />
      </div>
    )
  });

  if (resume.education.length > 0) {
    sections.push({
      key: 'education',
      estimatedHeight: 85 + resume.education.length * 70,
      content: (
        <div className="mt-8">
          <ResumeEducationList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (visibleSkills.length > 0) {
    sections.push({
      key: 'skills',
      estimatedHeight: 70 + Math.ceil(visibleSkills.length / 2) * 40,
      content: (
        <div className="mt-8">
          <ResumeSectionTitleBlock accent={accent}>Skills</ResumeSectionTitleBlock>
          <ResumeSkillGrid
            skills={visibleSkills}
            accent={accent}
            isPdf={isPdf}
            showPercent={true}
          />
        </div>
      )
    });
  }

  if (resume.languages.length > 0) {
    sections.push({
      key: 'languages',
      estimatedHeight: 55 + resume.languages.length * 40,
      content: (
        <div className="mt-8">
          <ResumeSectionTitleBlock accent={accent}>Languages</ResumeSectionTitleBlock>
          <ResumeLanguageListBlock resume={resume} />
        </div>
      )
    });
  }

  return sections;
};

const createMainSections = (resume: ResumeData, accent: string): PageSection[] => {
  const visibleExperience = createVisibleExperience(resume);
  const visibleAchievements = createVisibleAchievements(resume);
  const sections: PageSection[] = [];

  if (resume.professionalSummary?.trim()) {
    sections.push({
      key: 'summary',
      estimatedHeight: 120,
      content: <ResumeSummary resume={resume} accent={accent} />
    });
  }

  if (visibleExperience.length > 0) {
    sections.push({
      key: 'experience',
      estimatedHeight:
        85 +
        visibleExperience.reduce((total, exp) => {
          const bulletsCount = exp.bullets.filter((bullet) => bullet.trim().length > 0).length;
          return total + 84 + bulletsCount * 19;
        }, 0),
      content: (
        <div className={sections.length > 0 ? 'mt-10' : ''}>
          <ResumeSectionTitleBlock accent={accent}>Experience</ResumeSectionTitleBlock>

          <div className="space-y-8">
            {visibleExperience.map((exp, index) => (
              <article
                key={exp.id}
                className={`${index !== 0 ? 'border-t border-slate-200 pt-8' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[20px] font-semibold tracking-[0.02em] text-slate-900">
                      {exp.role}
                    </div>

                    <div className="mt-2 text-[14px] font-medium uppercase tracking-[0.14em] text-slate-500">
                      {[exp.company, exp.project, exp.location].filter(Boolean).join(' • ')}
                    </div>
                  </div>

                  <div className="shrink-0 text-[13px] font-medium uppercase tracking-[0.14em] text-slate-400">
                    {[exp.start, exp.end].filter(Boolean).join(' — ')}
                  </div>
                </div>

                {exp.bullets.some((bullet) => bullet.trim().length > 0) ? (
                  <div className="mt-4 space-y-2.5 text-[14px] leading-7 text-slate-700">
                    {exp.bullets
                      .filter((bullet) => bullet.trim().length > 0)
                      .map((bullet, bulletIndex) => (
                        <div key={`${exp.id}-bullet-${bulletIndex}`}>{bullet}</div>
                      ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      )
    });
  }

  if (resume.enabledSections.achievements && visibleAchievements.length > 0) {
    sections.push({
      key: 'achievements',
      estimatedHeight: 72 + visibleAchievements.length * 66,
      content: (
        <div className={sections.length > 0 ? 'mt-10' : ''}>
          <ResumeAchievementsList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.footer && resume.footer) {
    sections.push({
      key: 'footer',
      estimatedHeight: 70,
      content: (
        <div className={sections.length > 0 ? 'mt-10' : ''}>
          <ResumeFooterText title="Additional Note" value={resume.footer} accent={accent} />
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

export const buildPremiumClassicPages = (
  resume: ResumeData,
  isPdf = false
): ResumePage[] => {
  const accent = resume.editorSettings.accentColor || CLASSIC_ACCENT;
  const sidebarSections = createSidebarSections(resume, accent, isPdf);
  const mainSections = createMainSections(resume, accent);

  const defaultPages = paginateSections(sidebarSections, mainSections, DEFAULT_USABLE_HEIGHT);

  if (defaultPages.length === 1) {
    return defaultPages;
  }

  return paginateSections(sidebarSections, mainSections, RELAXED_USABLE_HEIGHT);
};

export const ResumePremiumClassic = ({
  resume,
  isPdf = false,
  pageIndex
}: Props) => {
  const accent = resume.editorSettings.accentColor || CLASSIC_ACCENT;
  const pages = buildPremiumClassicPages(resume, isPdf);
  const visiblePages =
    typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

  return (
    <>
      {visiblePages.map((page, index) => (
        <div
          key={`resume-premium-classic-page-${index}`}
          data-pdf-page="true"
          className={`${resumePaperClassName} rounded-none bg-[#f8f6f2]`}
          style={{
            ...resumePaperStyle,
            width: '794px',
            minHeight: `${PAGE_HEIGHT}px`,
            fontSize: `${resume.editorSettings.baseFontSize}px`,
            breakAfter: index === visiblePages.length - 1 ? 'auto' : 'page',
            pageBreakAfter: index === visiblePages.length - 1 ? 'auto' : 'always'
          }}
        >
          <div
            className="grid h-full"
            style={{
              gridTemplateColumns: '280px 1fr',
              minHeight: `${PAGE_HEIGHT}px`
            }}
          >
            <aside className="bg-[#efebe4] px-8 pb-10 pt-10">
              <div className="mb-8 h-px w-full bg-slate-300" />
              {page.sidebarSections.map((section) => (
                <div key={section.key}>{section.content}</div>
              ))}
            </aside>

            <main className="bg-[#fcfbf8] px-12 pb-12 pt-12">
              <div
                className="mb-10 h-px w-full"
                style={{ backgroundColor: `${accent}55` }}
              />
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