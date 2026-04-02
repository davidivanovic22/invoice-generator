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
  leftSections: PageSection[];
  rightSections: PageSection[];
};

const PAGE_HEIGHT = 1123;
const HEADER_HEIGHT = 176;
const PAGE_BOTTOM_PADDING = 40;
const CONTENT_TOP_PADDING = 40;
const USABLE_HEIGHT =
  PAGE_HEIGHT - HEADER_HEIGHT - PAGE_BOTTOM_PADDING - CONTENT_TOP_PADDING;

const createTopBannerHeader = (resume: ResumeData) => {
  return (
    <header
      className="px-10 py-8 text-white"
      style={{ background: resume.editorSettings.accentColor }}
    >
      <div className="flex items-center gap-6">
        <ResumePhotoBlock
          photo={resume.personal.photo}
          alt={resume.personal.fullName}
          light
          sizeClassName="h-24 w-24"
          rounded="rounded-full"
        />

        <div className="flex-1">
          <h1 className="text-[32px] font-bold leading-tight">
            {resume.personal.fullName}
          </h1>

          {resume.personal.title ? (
            <p className="mt-2 text-[18px] text-white/90">
              {resume.personal.title}
            </p>
          ) : null}

          {(resume.personal.email || resume.personal.phone) && (
            <div className="mt-3 text-sm text-white/85">
              {[resume.personal.email, resume.personal.phone]
                .filter(Boolean)
                .join(' • ')}
            </div>
          )}

          {resume.personal.address ? (
            <div className="mt-1 text-sm text-white/85">
              {resume.personal.address}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

const createLeftSections = (
  resume: ResumeData,
  accent: string,
  isPdf: boolean,
  isFirstPage: boolean
): PageSection[] => {
  const sections: PageSection[] = [];

  if (isFirstPage) {
    sections.push({
      key: 'summary',
      estimatedHeight: resume.professionalSummary ? 140 : 24,
      content: <ResumeSummary resume={resume} accent={accent} />
    });
  }

  sections.push({
    key: 'experience',
    estimatedHeight: 100 + (resume.experience?.length ?? 0) * 150,
    content: (
      <div className={isFirstPage ? 'mt-8' : ''}>
        <ResumeExperienceList resume={resume} accent={accent} isPdf={isPdf} />
      </div>
    )
  });

  if (resume.enabledSections.internships && resume.internships.length > 0) {
    sections.push({
      key: 'internships',
      estimatedHeight: 90 + resume.internships.length * 110,
      content: (
        <div className="mt-8">
          <ResumeInternshipsList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (
    resume.enabledSections.extracurricularActivities &&
    resume.extracurricularActivities.length > 0
  ) {
    sections.push({
      key: 'activities',
      estimatedHeight: 80 + resume.extracurricularActivities.length * 46,
      content: (
        <div className="mt-8">
          <ResumeStringSection
            title="Extracurricular Activities"
            items={resume.extracurricularActivities}
            accent={accent}
          />
        </div>
      )
    });
  }

  if (resume.enabledSections.achievements && resume.achievements.length > 0) {
    sections.push({
      key: 'achievements',
      estimatedHeight: 90 + resume.achievements.length * 70,
      content: (
        <div className="mt-8">
          <ResumeAchievementsList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.footer && resume.footer) {
    sections.push({
      key: 'footer',
      estimatedHeight: 90,
      content: (
        <div className="mt-8">
          <ResumeFooterText title="Footer" value={resume.footer} accent={accent} />
        </div>
      )
    });
  }

  return sections;
};

const createRightSections = (
  resume: ResumeData,
  accent: string,
  isPdf: boolean
): PageSection[] => {
  const sections: PageSection[] = [];

  sections.push({
    key: 'contact',
    estimatedHeight: 150,
    content: (
      <section>
        <ResumeSectionTitleBlock accent={accent}>Contact</ResumeSectionTitleBlock>
        <ResumeContactListBlock resume={resume} />
      </section>
    )
  });

  sections.push({
    key: 'skills',
    estimatedHeight: 90 + Math.ceil((resume.skills?.length ?? 0) / 2) * 54,
    content: (
      <section className="mt-8">
        <ResumeSectionTitleBlock accent={accent}>Skills</ResumeSectionTitleBlock>
        <ResumeSkillGrid skills={resume.skills} accent={accent} isPdf={isPdf} />
      </section>
    )
  });

  sections.push({
    key: 'education',
    estimatedHeight: 120 + (resume.education?.length ?? 0) * 90,
    content: (
      <section className="mt-8">
        <ResumeEducationList resume={resume} accent={accent} />
      </section>
    )
  });

  if (resume.enabledSections.courses && resume.courses.length > 0) {
    sections.push({
      key: 'courses',
      estimatedHeight: 80 + resume.courses.length * 70,
      content: (
        <section className="mt-8">
          <ResumeCoursesList resume={resume} accent={accent} />
        </section>
      )
    });
  }

  sections.push({
    key: 'languages',
    estimatedHeight: 70 + (resume.languages?.length ?? 0) * 50,
    content: (
      <section className="mt-8">
        <ResumeSectionTitleBlock accent={accent}>Languages</ResumeSectionTitleBlock>
        <ResumeLanguageListBlock resume={resume} />
      </section>
    )
  });

  if (resume.enabledSections.qualities && resume.qualities.length > 0) {
    sections.push({
      key: 'qualities',
      estimatedHeight: 70 + resume.qualities.length * 56,
      content: (
        <section className="mt-8">
          <ResumeDotPercentageRatings items={resume.qualities} accent={accent} />
        </section>
      )
    });
  }

  if (resume.enabledSections.certificates && resume.certificates.length > 0) {
    sections.push({
      key: 'certificates',
      estimatedHeight: 80 + resume.certificates.length * 70,
      content: (
        <section className="mt-8">
          <ResumeCertificatesList resume={resume} accent={accent} />
        </section>
      )
    });
  }

  if (resume.enabledSections.references && resume.references.length > 0) {
    sections.push({
      key: 'references',
      estimatedHeight: 80 + resume.references.length * 72,
      content: (
        <section className="mt-8">
          <ResumeReferencesList resume={resume} accent={accent} />
        </section>
      )
    });
  }

  return sections;
};

const paginateColumnSections = (
  leftSections: PageSection[],
  rightSections: PageSection[]
): ResumePage[] => {
  const pages: ResumePage[] = [];

  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftSections.length || rightIndex < rightSections.length) {
    let leftUsed = 0;
    let rightUsed = 0;

    const pageLeft: PageSection[] = [];
    const pageRight: PageSection[] = [];

    while (leftIndex < leftSections.length) {
      const section = leftSections[leftIndex];
      const nextHeight = leftUsed + section.estimatedHeight;

      if (pageLeft.length > 0 && nextHeight > USABLE_HEIGHT) {
        break;
      }

      pageLeft.push(section);
      leftUsed = nextHeight;
      leftIndex += 1;
    }

    while (rightIndex < rightSections.length) {
      const section = rightSections[rightIndex];
      const nextHeight = rightUsed + section.estimatedHeight;

      if (pageRight.length > 0 && nextHeight > USABLE_HEIGHT) {
        break;
      }

      pageRight.push(section);
      rightUsed = nextHeight;
      rightIndex += 1;
    }

    if (pageLeft.length === 0 && leftIndex < leftSections.length) {
      pageLeft.push(leftSections[leftIndex]);
      leftIndex += 1;
    }

    if (pageRight.length === 0 && rightIndex < rightSections.length) {
      pageRight.push(rightSections[rightIndex]);
      rightIndex += 1;
    }

    if (pageLeft.length > 0 || pageRight.length > 0) {
      pages.push({
        leftSections: pageLeft,
        rightSections: pageRight
      });
    }
  }

  return pages.filter(
    (page) => page.leftSections.length > 0 || page.rightSections.length > 0
  );
};

export const buildTopBannerPages = (
  resume: ResumeData,
  isPdf = false
): ResumePage[] => {
  const accent = resume.editorSettings.accentColor;

  const firstPageLeft = createLeftSections(resume, accent, isPdf, true);
  const otherPagesLeft = createLeftSections(resume, accent, isPdf, false);
  const rightSections = createRightSections(resume, accent, isPdf);

  const summarySection = firstPageLeft.find((section) => section.key === 'summary');
  const nonSummarySections = otherPagesLeft;

  const allLeftSections = summarySection
    ? [summarySection, ...nonSummarySections]
    : nonSummarySections;

  return paginateColumnSections(allLeftSections, rightSections);
};

export const ResumeTopBanner = ({
  resume,
  isPdf = false,
  pageIndex
}: Props) => {
  const pages = buildTopBannerPages(resume, isPdf);
  const visiblePages =
    typeof pageIndex === 'number'
      ? pages.filter((_, index) => index === pageIndex)
      : pages;

  return (
    <>
      {visiblePages.map((page, visiblePageIndex) => {
        const actualPageIndex =
          typeof pageIndex === 'number' ? pageIndex : visiblePageIndex;

        return (
          <div
            key={`resume-top-banner-page-${actualPageIndex}`}
            data-pdf-page="true"
            className={`${resumePaperClassName} overflow-hidden rounded-none`}
            style={{
              ...resumePaperStyle,
              width: '794px',
              minHeight: '1123px',
              fontSize: `${resume.editorSettings.baseFontSize}px`,
              breakAfter:
                visiblePageIndex === visiblePages.length - 1 ? 'auto' : 'page',
              pageBreakAfter:
                visiblePageIndex === visiblePages.length - 1 ? 'auto' : 'always'
            }}
          >
            {createTopBannerHeader(resume)}

            <main className="grid grid-cols-[1.35fr_0.65fr] gap-8 px-10 pb-10 pt-10 text-slate-800">
              <div>
                {page.leftSections.map((section, sectionIndex) => (
                  <div key={`left-${actualPageIndex}-${section.key}-${sectionIndex}`}>
                    {section.content}
                  </div>
                ))}
              </div>

              <div>
                {page.rightSections.map((section, sectionIndex) => (
                  <div key={`right-${actualPageIndex}-${section.key}-${sectionIndex}`}>
                    {section.content}
                  </div>
                ))}
              </div>
            </main>
          </div>
        );
      })}
    </>
  );
};