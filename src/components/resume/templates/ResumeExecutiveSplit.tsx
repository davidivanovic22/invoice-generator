import type { ReactNode } from 'react';
import { ResumeData } from '../../../types/resume';
import { ResumeContactListBlock } from '../blocks/ResumeContactListBlock';
import { ResumeLanguageListBlock } from '../blocks/ResumeLanguageListBlock';
import { ResumePhotoBlock } from '../blocks/ResumePhotoBlock';
import { ResumeSectionTitleBlock } from '../blocks/ResumeSectionTitleBlock';
import {
  ResumeAchievementsList,
  ResumeCertificatesList,
  ResumeCoursesList,
  ResumeDotPercentageRatings,
  ResumeEducationList,
  ResumeExperienceList,
  ResumeFooterText,
  ResumeInternshipsList,
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

const createSidebarSections = (
  resume: ResumeData,
  accent: string,
  isPdf: boolean
): PageSection[] => {
  const sections: PageSection[] = [];
  const visibleSkills = resume.skills.filter(
    (skill) => (skill.name ?? '').trim().length > 0 && (skill.percent ?? 0) > 0
  );
  const visibleQualities = resume.qualities.filter(
    (item) => (item.name ?? '').trim().length > 0 && (item.percent ?? 0) > 0
  );
  const visibleReferences = resume.references.filter(
    (item) =>
      Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );
  const visibleLanguages = resume.languages.filter(
    (item) =>
      Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

  sections.push({
    key: 'sidebar-header',
    estimatedHeight: 185,
    content: (
      <div className="flex flex-col items-center border-b border-white/20 pb-6">
        <ResumePhotoBlock
          photo={resume.personal.photo}
          alt={resume.personal.fullName}
          light
          sizeClassName="h-32 w-32"
          rounded="rounded-2xl"
        />

        <h1 className="mt-5 w-full text-left text-[20px] font-bold leading-tight">
          {resume.personal.fullName}
        </h1>

        {resume.personal.title ? (
          <p className="mt-1 w-full text-left text-sm text-white/80">
            {resume.personal.title}
          </p>
        ) : null}
      </div>
    )
  });

  sections.push({
    key: 'contact',
    estimatedHeight: 130,
    content: (
      <section className="mt-6">
        <ResumeSectionTitleBlock accent={accent} light>
          Contact
        </ResumeSectionTitleBlock>
        <ResumeContactListBlock resume={resume} light />
      </section>
    )
  });

  if (visibleSkills.length > 0) {
    sections.push({
      key: 'skills',
      estimatedHeight: 80 + Math.ceil(visibleSkills.length / 2) * 40,
      content: (
        <section className="mt-7">
          <ResumeSectionTitleBlock accent={accent} light>
            Skills
          </ResumeSectionTitleBlock>
          <ResumeSkillGrid skills={visibleSkills} accent={accent} light isPdf={isPdf} />
        </section>
      )
    });
  }

  if (resume.enabledSections.qualities && visibleQualities.length > 0) {
    sections.push({
      key: 'qualities',
      estimatedHeight: 50 + visibleQualities.length * 36,
      content: (
        <section className="mt-7">
          <ResumeDotPercentageRatings items={visibleQualities} accent={accent} light />
        </section>
      )
    });
  }

  if (resume.enabledSections.references && visibleReferences.length > 0) {
    sections.push({
      key: 'references',
      estimatedHeight: 55 + visibleReferences.length * 52,
      content: (
        <section className="mt-7">
          <ResumeReferencesList resume={resume} accent={accent} light />
        </section>
      )
    });
  }

  if (visibleLanguages.length > 0) {
    sections.push({
      key: 'languages',
      estimatedHeight: 55 + visibleLanguages.length * 36,
      content: (
        <section className="mt-7">
          <ResumeSectionTitleBlock accent={accent} light>
            Languages
          </ResumeSectionTitleBlock>
          <ResumeLanguageListBlock resume={resume} light />
        </section>
      )
    });
  }

  if (resume.enabledSections.signature && resume.signature) {
    sections.push({
      key: 'signature',
      estimatedHeight: 80,
      content: (
        <section className="mt-7">
          <ResumeFooterText title="Signature" value={resume.signature} accent={accent} light />
        </section>
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
  const sections: PageSection[] = [];

  const visibleExperience = resume.experience.filter(
    (item) =>
      (item.role ?? '').trim().length > 0 ||
      (item.company ?? '').trim().length > 0 ||
      (item.project ?? '').trim().length > 0 ||
      (item.location ?? '').trim().length > 0 ||
      item.bullets.some((bullet) => bullet.trim().length > 0)
  );

  const visibleInternships = resume.internships.filter(
    (item) =>
      Object.values(item ?? {}).some((value) => {
        if (Array.isArray(value)) {
          return value.some((entry) => String(entry ?? '').trim().length > 0);
        }
        return String(value ?? '').trim().length > 0;
      })
  );

  const visibleEducation = resume.education.filter(
    (item) =>
      (item.school ?? '').trim().length > 0 ||
      (item.degree ?? '').trim().length > 0 ||
      (item.start ?? '').trim().length > 0 ||
      (item.end ?? '').trim().length > 0
  );

  const visibleCourses = resume.courses.filter(
    (item) =>
      Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

  const visibleCertificates = resume.certificates.filter(
    (item) =>
      Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

  const visibleAchievements = resume.achievements.filter(
    (item) => (item.title ?? '').trim().length > 0 || (item.description ?? '').trim().length > 0
  );

  const visibleActivities = resume.extracurricularActivities.filter(
    (item) => String(item ?? '').trim().length > 0
  );

  sections.push({
    key: 'summary',
    estimatedHeight: resume.professionalSummary ? 95 : 18,
    content: <ResumeSummary resume={resume} accent={accent} />
  });

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
        <div className="mt-8">
          <ResumeExperienceList resume={resume} accent={accent} isPdf={isPdf} />
        </div>
      )
    });
  }

  if (resume.enabledSections.internships && visibleInternships.length > 0) {
    sections.push({
      key: 'internships',
      estimatedHeight: 70 + visibleInternships.length * 78,
      content: (
        <div className="mt-8">
          <ResumeInternshipsList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  const leftColumnItems: ReactNode[] = [];
  let leftEstimated = 0;

  if (visibleEducation.length > 0) {
    leftColumnItems.push(
      <ResumeEducationList key="education" resume={resume} accent={accent} />
    );
    leftEstimated += 90 + visibleEducation.length * 64;
  }

  if (resume.enabledSections.courses && visibleCourses.length > 0) {
    leftColumnItems.push(
      <div key="courses" className="mt-8">
        <ResumeCoursesList resume={resume} accent={accent} />
      </div>
    );
    leftEstimated += 70 + visibleCourses.length * 52;
  }

  const rightColumnItems: ReactNode[] = [];
  let rightEstimated = 0;

  if (resume.enabledSections.certificates && visibleCertificates.length > 0) {
    rightColumnItems.push(
      <div key="certificates">
        <ResumeCertificatesList resume={resume} accent={accent} />
      </div>
    );
    rightEstimated += 70 + visibleCertificates.length * 52;
  }

  if (resume.enabledSections.achievements && visibleAchievements.length > 0) {
    rightColumnItems.push(
      <div key="achievements" className="mt-8">
        <ResumeAchievementsList resume={resume} accent={accent} />
      </div>
    );
    rightEstimated += 70 + visibleAchievements.length * 52;
  }

  if (
    resume.enabledSections.extracurricularActivities &&
    visibleActivities.length > 0
  ) {
    rightColumnItems.push(
      <div key="activities" className="mt-8">
        <ResumeStringSection
          title="Extracurricular Activities"
          items={visibleActivities}
          accent={accent}
        />
      </div>
    );
    rightEstimated += 70 + visibleActivities.length * 34;
  }

  if (leftColumnItems.length > 0 || rightColumnItems.length > 0) {
    sections.push({
      key: 'lower-grid',
      estimatedHeight: Math.max(leftEstimated, rightEstimated, 60) + 20,
      content: (
        <section className="mt-8 grid grid-cols-[1fr_1fr] items-start gap-10">
          <div>{leftColumnItems}</div>
          <div>{rightColumnItems}</div>
        </section>
      )
    });
  }

  if (resume.enabledSections.footer && resume.footer) {
    sections.push({
      key: 'footer',
      estimatedHeight: 75,
      content: (
        <div className="mt-8">
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

export const buildExecutiveSplitPages = (
  resume: ResumeData,
  isPdf = false
): ResumePage[] => {
  const accent = resume.editorSettings.accentColor;
  const sidebarSections = createSidebarSections(resume, accent, isPdf);
  const mainSections = createMainSections(resume, accent, isPdf);

  const defaultPages = paginateSections(
    sidebarSections,
    mainSections,
    DEFAULT_USABLE_HEIGHT
  );

  if (defaultPages.length === 1) {
    return defaultPages;
  }

  return paginateSections(sidebarSections, mainSections, RELAXED_USABLE_HEIGHT);
};

export const ResumeExecutiveSplit = ({
  resume,
  isPdf = false,
  pageIndex
}: Props) => {
  const accent = resume.editorSettings.accentColor;
  const pages = buildExecutiveSplitPages(resume, isPdf);
  const visiblePages =
    typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

  return (
    <>
      {visiblePages.map((page, index) => (
        <div
          key={`resume-page-${index}`}
          className={`${resumePaperClassName} rounded-none`}
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
              gridTemplateColumns: '290px 1fr',
              minHeight: `${PAGE_HEIGHT}px`
            }}
          >
            <aside
              className="p-7 text-white"
              style={{
                background: accent,
                minHeight: `${PAGE_HEIGHT}px`
              }}
            >
              {page.sidebarSections.map((section) => (
                <div key={section.key}>{section.content}</div>
              ))}
            </aside>

            <main className="p-7 text-slate-800">
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