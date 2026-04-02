import type { ReactNode } from 'react';
import { ResumeData } from '../../../types/resume';
import { ResumeLanguageListBlock } from '../blocks/ResumeLanguageListBlock';
import { ResumePhotoBlock } from '../blocks/ResumePhotoBlock';
import { ResumeSectionTitleBlock } from '../blocks/ResumeSectionTitleBlock';
import {
  ResumeAchievementsList,
  ResumeCompactReferences,
  ResumeDotPercentageRatings,
  ResumeExperienceList,
  ResumeProfessionalSkillsBubbles,
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
  headerSections: PageSection[];
  summarySections: PageSection[];
  sidebarSections: PageSection[];
  mainSections: PageSection[];
};

const PAGE_HEIGHT = 1123;
const HEADER_ESTIMATED_HEIGHT = 132;
const SUMMARY_ESTIMATED_HEIGHT = 110;
const PAGE_VERTICAL_PADDING = 40;
const USABLE_BODY_HEIGHT =
  PAGE_HEIGHT - HEADER_ESTIMATED_HEIGHT - SUMMARY_ESTIMATED_HEIGHT - PAGE_VERTICAL_PADDING;

const getTopSkills = (resume: ResumeData) =>
  [...resume.skills]
    .filter((skill) => (skill.name ?? '').trim().length > 0 && (skill.percent ?? 0) > 0)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
    .slice(0, 8);

const getTopQualities = (resume: ResumeData) =>
  resume.qualities.filter(
    (item) => (item.name ?? '').trim().length > 0 && (item.percent ?? 0) > 0
  );

const hasVisibleExperience = (resume: ResumeData) =>
  resume.experience.some(
    (item) =>
      (item.role ?? '').trim().length > 0 ||
      (item.company ?? '').trim().length > 0 ||
      (item.project ?? '').trim().length > 0 ||
      (item.location ?? '').trim().length > 0 ||
      item.bullets.some((bullet) => bullet.trim().length > 0)
  );

const createHeaderSection = (resume: ResumeData): PageSection => ({
  key: 'header',
  estimatedHeight: HEADER_ESTIMATED_HEIGHT,
  content: (
    <header className="bg-[#6b7280] px-10 pb-5 pt-8 text-white">
      <div className="grid grid-cols-[110px_1fr] items-center gap-6">
        <div className="rounded-full border-[6px] border-white/80 p-1">
          <ResumePhotoBlock
            photo={resume.personal.photo}
            alt={resume.personal.fullName}
            rounded="rounded-full"
            sizeClassName="h-24 w-24"
            light
          />
        </div>

        <div>
          <h1 className="text-[30px] font-extrabold uppercase tracking-wide">
            {resume.personal.fullName}
          </h1>

          <div className="mt-1 text-[16px] text-white/85">{resume.personal.title}</div>

          <div className="mt-3 text-[12px] text-white/80">
            {[resume.personal.email, resume.personal.phone, resume.personal.website]
              .filter(Boolean)
              .join('  •  ')}
          </div>
        </div>
      </div>
    </header>
  )
});

const createSummarySection = (resume: ResumeData, accent: string): PageSection => ({
  key: 'summary',
  estimatedHeight: resume.professionalSummary ? SUMMARY_ESTIMATED_HEIGHT : 36,
  content: (
    <div className="bg-white px-10 py-5">
      <ResumeSummary resume={resume} accent={accent} />
    </div>
  )
});

const createSidebarSections = (
  resume: ResumeData,
  accent: string,
  darkAccent: string,
  isPdf: boolean
): PageSection[] => {
  const topSkills = getTopSkills(resume);
  const sections: PageSection[] = [];

  if (resume.education.length > 0) {
    sections.push({
      key: 'education',
      estimatedHeight: 80 + resume.education.length * 74,
      content: <ResumeEducationListBlock resume={resume} accent={accent} />
    });
  }

  if (topSkills.length > 0) {
    sections.push({
      key: 'professional-skills',
      estimatedHeight: 250 + topSkills.length * 26,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeSectionTitleBlock accent={accent}>Professional Skills</ResumeSectionTitleBlock>

          <ResumeProfessionalSkillsBubbles skills={topSkills} accent={accent} isPdf={isPdf} />

          <div className="mt-4">
            <ResumeDotPercentageRatings
              items={topSkills}
              accent={accent}
              darkAccent={darkAccent}
            />
          </div>
        </div>
      )
    });
  }

  if (resume.languages.length > 0) {
    sections.push({
      key: 'languages',
      estimatedHeight: 70 + resume.languages.length * 52,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeSectionTitleBlock accent={accent}>Languages</ResumeSectionTitleBlock>
          <ResumeLanguageListBlock resume={resume} />
        </div>
      )
    });
  }

  if (resume.enabledSections.achievements && resume.achievements.length > 0) {
    sections.push({
      key: 'achievements',
      estimatedHeight: 90 + resume.achievements.length * 72,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeAchievementsList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  return sections;
};

const createMainSections = (
  resume: ResumeData,
  accent: string,
  darkAccent: string,
  isPdf: boolean
): PageSection[] => {
  const topQualities = getTopQualities(resume);
  const sections: PageSection[] = [];

  if (hasVisibleExperience(resume)) {
    sections.push({
      key: 'experience',
      estimatedHeight:
        100 +
        resume.experience.reduce((total, item) => {
          const bulletCount = item.bullets.filter((bullet) => bullet.trim().length > 0).length;
          return total + 110 + bulletCount * 24;
        }, 0),
      content: (
        <div className="space-y-6">
          <ResumeExperienceList resume={resume} accent={accent} isPdf={isPdf} />
        </div>
      )
    });
  }

  if (resume.enabledSections.qualities && topQualities.length > 0) {
    sections.push({
      key: 'qualities',
      estimatedHeight: 90 + topQualities.length * 56,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeSectionTitleBlock accent={accent}>Personal Qualities</ResumeSectionTitleBlock>

          <ResumeDotPercentageRatings
            items={topQualities}
            accent={accent}
            darkAccent={darkAccent}
          />
        </div>
      )
    });
  }

  if (resume.enabledSections.references && resume.references.length > 0) {
    sections.push({
      key: 'references',
      estimatedHeight: 90 + Math.ceil(resume.references.length / 2) * 72,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeCompactReferences resume={resume} accent={accent} />
        </div>
      )
    });
  }

  return sections;
};

const paginateSections = (
  headerSections: PageSection[],
  summarySections: PageSection[],
  sidebarSections: PageSection[],
  mainSections: PageSection[]
): ResumePage[] => {
  const pages: ResumePage[] = [];

  let sidebarIndex = 0;
  let mainIndex = 0;

  let isFirstPage = true;

  while (sidebarIndex < sidebarSections.length || mainIndex < mainSections.length || isFirstPage) {
    let sidebarUsed = 0;
    let mainUsed = 0;

    const pageSidebar: PageSection[] = [];
    const pageMain: PageSection[] = [];

    while (sidebarIndex < sidebarSections.length) {
      const section = sidebarSections[sidebarIndex];
      const nextHeight = sidebarUsed + section.estimatedHeight;

      if (pageSidebar.length > 0 && nextHeight > USABLE_BODY_HEIGHT) break;

      pageSidebar.push(section);
      sidebarUsed = nextHeight;
      sidebarIndex += 1;
    }

    while (mainIndex < mainSections.length) {
      const section = mainSections[mainIndex];
      const nextHeight = mainUsed + section.estimatedHeight;

      if (pageMain.length > 0 && nextHeight > USABLE_BODY_HEIGHT) break;

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

    const includeHeader = isFirstPage ? headerSections : [];
    const includeSummary = isFirstPage ? summarySections : [];

    if (
      includeHeader.length > 0 ||
      includeSummary.length > 0 ||
      pageSidebar.length > 0 ||
      pageMain.length > 0
    ) {
      pages.push({
        headerSections: includeHeader,
        summarySections: includeSummary,
        sidebarSections: pageSidebar,
        mainSections: pageMain
      });
    }

    isFirstPage = false;

    if (sidebarIndex >= sidebarSections.length && mainIndex >= mainSections.length && !isFirstPage) {
      break;
    }
  }

  return pages;
};

export const buildInfographicSplitPages = (
  resume: ResumeData,
  isPdf = false
): ResumePage[] => {
  const accent = resume.editorSettings.accentColor || '#ef4444';
  const darkAccent = '#17324d';

  const headerSections = [createHeaderSection(resume)];
  const summarySections = [createSummarySection(resume, accent)];
  const sidebarSections = createSidebarSections(resume, accent, darkAccent, isPdf);
  const mainSections = createMainSections(resume, accent, darkAccent, isPdf);

  return paginateSections(headerSections, summarySections, sidebarSections, mainSections);
};

export const ResumeInfographicSplit = ({
  resume,
  isPdf = false,
  pageIndex
}: Props) => {
  const pages = buildInfographicSplitPages(resume, isPdf);
  const visiblePages =
    typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

  return (
    <>
      {visiblePages.map((page, index) => (
        <div
          key={`resume-infographic-split-page-${index}`}
          className={`${resumePaperClassName} rounded-none bg-[#f8fafc]`}
          style={{
            ...resumePaperStyle,
            width: '794px',
            minHeight: '1123px',
            fontSize: `${resume.editorSettings.baseFontSize}px`,
            breakAfter: index === visiblePages.length - 1 ? 'auto' : 'page',
            pageBreakAfter: index === visiblePages.length - 1 ? 'auto' : 'always'
          }}
        >
          {page.headerSections.map((section) => (
            <div key={section.key}>{section.content}</div>
          ))}

          {page.summarySections.map((section) => (
            <div key={section.key}>{section.content}</div>
          ))}

          <div className="grid grid-cols-[0.95fr_1.05fr] gap-0">
            <aside className="bg-[#f3f4f6] px-8 py-8">
              {page.sidebarSections.map((section) => (
                <div key={section.key}>{section.content}</div>
              ))}
            </aside>

            <main className="bg-white px-8 py-8">
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

const ResumeEducationListBlock = ({
  resume,
  accent
}: {
  resume: ResumeData;
  accent: string;
}) => {
  if (!resume.education.length) return null;

  return (
    <section>
      <ResumeSectionTitleBlock accent={accent}>Education</ResumeSectionTitleBlock>

      <div className="space-y-5">
        {resume.education.map((edu) => (
          <article key={edu.id}>
            <div className="text-[13px] font-semibold" style={{ color: accent }}>
              {edu.start} - {edu.end}
            </div>

            <div className="mt-1 text-[15px] font-bold text-slate-900">{edu.school}</div>

            <div className="text-[13px] text-slate-600">{edu.degree}</div>
          </article>
        ))}
      </div>
    </section>
  );
};