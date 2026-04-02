import type { ReactNode } from 'react';
import { ResumeData } from '../../../types/resume';
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
  introSections: PageSection[];
  fullWidthSections: PageSection[];
  lowerLeftSections: PageSection[];
  lowerRightSections: PageSection[];
  bottomSections: PageSection[];
};

const PAGE_HEIGHT = 1123;
const PAGE_VERTICAL_PADDING = 96;
const USABLE_HEIGHT = PAGE_HEIGHT - PAGE_VERTICAL_PADDING;

const createHeaderSection = (resume: ResumeData, accent: string): PageSection => ({
  key: 'header',
  estimatedHeight: 210,
  content: (
    <>
      <header className="mb-8 text-center">
        <div className="flex flex-col items-center">
          <ResumePhotoBlock
            photo={resume.personal.photo}
            alt={resume.personal.fullName}
            sizeClassName="h-24 w-24"
            rounded="rounded-md"
          />

          <h1 className="mt-5 text-[32px] font-semibold leading-tight">
            {resume.personal.fullName}
          </h1>

          {resume.personal.title ? (
            <p className="mt-2 text-[15px]" style={{ color: accent }}>
              {resume.personal.title}
            </p>
          ) : null}

          {(resume.personal.email || resume.personal.phone) && (
            <div className="mt-3 text-sm text-slate-600">
              {[resume.personal.email, resume.personal.phone].filter(Boolean).join(' • ')}
            </div>
          )}

          {resume.personal.address ? (
            <div className="mt-1 text-sm text-slate-600">{resume.personal.address}</div>
          ) : null}
        </div>
      </header>

      <div className="mb-8 border-t" style={{ borderColor: `${accent}55` }} />
    </>
  )
});

const createIntroSections = (resume: ResumeData, accent: string): PageSection[] => {
  const sections: PageSection[] = [];

  sections.push(createHeaderSection(resume, accent));

  sections.push({
    key: 'summary',
    estimatedHeight: resume.professionalSummary ? 140 : 28,
    content: <ResumeSummary resume={resume} accent={accent} />
  });

  return sections;
};

const createFullWidthSections = (
  resume: ResumeData,
  accent: string,
  isPdf: boolean
): PageSection[] => {
  const sections: PageSection[] = [];

  sections.push({
    key: 'experience',
    estimatedHeight: 120 + (resume.experience?.length ?? 0) * 150,
    content: (
      <div className="mt-8">
        <ResumeExperienceList resume={resume} accent={accent} isPdf={isPdf} />
      </div>
    )
  });

  if (resume.enabledSections.internships && resume.internships.length > 0) {
    sections.push({
      key: 'internships',
      estimatedHeight: 100 + resume.internships.length * 110,
      content: (
        <div className="mt-8">
          <ResumeInternshipsList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  return sections;
};

const createLowerLeftSections = (resume: ResumeData, accent: string): PageSection[] => {
  const sections: PageSection[] = [];

  sections.push({
    key: 'education',
    estimatedHeight: 140 + (resume.education?.length ?? 0) * 90,
    content: <ResumeEducationList resume={resume} accent={accent} />
  });

  if (resume.enabledSections.courses && resume.courses.length > 0) {
    sections.push({
      key: 'courses',
      estimatedHeight: 90 + resume.courses.length * 70,
      content: (
        <div className="mt-8">
          <ResumeCoursesList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.references && resume.references.length > 0) {
    sections.push({
      key: 'references',
      estimatedHeight: 90 + resume.references.length * 72,
      content: (
        <div className="mt-8">
          <ResumeReferencesList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  return sections;
};

const createLowerRightSections = (
  resume: ResumeData,
  accent: string,
  isPdf: boolean
): PageSection[] => {
  const sections: PageSection[] = [];

  sections.push({
    key: 'skills',
    estimatedHeight: 90 + Math.ceil((resume.skills?.length ?? 0) / 2) * 54,
    content: (
      <>
        <ResumeSectionTitleBlock accent={accent}>Skills</ResumeSectionTitleBlock>
        <ResumeSkillGrid skills={resume.skills} accent={accent} isPdf={isPdf} />
      </>
    )
  });

  sections.push({
    key: 'languages',
    estimatedHeight: 70 + (resume.languages?.length ?? 0) * 52,
    content: (
      <div className="mt-8">
        <ResumeSectionTitleBlock accent={accent}>Languages</ResumeSectionTitleBlock>
        <ResumeLanguageListBlock resume={resume} />
      </div>
    )
  });

  if (resume.enabledSections.qualities && resume.qualities.length > 0) {
    sections.push({
      key: 'qualities',
      estimatedHeight: 80 + resume.qualities.length * 56,
      content: (
        <div className="mt-8">
          <ResumeDotPercentageRatings items={resume.qualities} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.certificates && resume.certificates.length > 0) {
    sections.push({
      key: 'certificates',
      estimatedHeight: 90 + resume.certificates.length * 70,
      content: (
        <div className="mt-8">
          <ResumeCertificatesList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  return sections;
};

const createBottomSections = (resume: ResumeData, accent: string): PageSection[] => {
  const sections: PageSection[] = [];

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

const paginateSections = (
  introSections: PageSection[],
  fullWidthSections: PageSection[],
  lowerLeftSections: PageSection[],
  lowerRightSections: PageSection[],
  bottomSections: PageSection[]
): ResumePage[] => {
  const pages: ResumePage[] = [];

  let introIndex = 0;
  let fullWidthIndex = 0;
  let leftIndex = 0;
  let rightIndex = 0;
  let bottomIndex = 0;

  while (
    introIndex < introSections.length ||
    fullWidthIndex < fullWidthSections.length ||
    leftIndex < lowerLeftSections.length ||
    rightIndex < lowerRightSections.length ||
    bottomIndex < bottomSections.length
  ) {
    let usedHeight = 0;

    const pageIntro: PageSection[] = [];
    const pageFullWidth: PageSection[] = [];
    const pageLeft: PageSection[] = [];
    const pageRight: PageSection[] = [];
    const pageBottom: PageSection[] = [];

    while (introIndex < introSections.length) {
      const section = introSections[introIndex];
      const nextHeight = usedHeight + section.estimatedHeight;

      if (pageIntro.length > 0 && nextHeight > USABLE_HEIGHT) break;

      pageIntro.push(section);
      usedHeight = nextHeight;
      introIndex += 1;
    }

    while (fullWidthIndex < fullWidthSections.length) {
      const section = fullWidthSections[fullWidthIndex];
      const nextHeight = usedHeight + section.estimatedHeight;

      if ((pageIntro.length > 0 || pageFullWidth.length > 0) && nextHeight > USABLE_HEIGHT) break;

      pageFullWidth.push(section);
      usedHeight = nextHeight;
      fullWidthIndex += 1;
    }

    const remainingForGridAndBottom = Math.max(USABLE_HEIGHT - usedHeight, 0);

    let leftUsed = 0;
    let rightUsed = 0;

    while (leftIndex < lowerLeftSections.length) {
      const section = lowerLeftSections[leftIndex];
      const nextHeight = leftUsed + section.estimatedHeight;

      if (pageLeft.length > 0 && nextHeight > remainingForGridAndBottom) break;

      pageLeft.push(section);
      leftUsed = nextHeight;
      leftIndex += 1;
    }

    while (rightIndex < lowerRightSections.length) {
      const section = lowerRightSections[rightIndex];
      const nextHeight = rightUsed + section.estimatedHeight;

      if (pageRight.length > 0 && nextHeight > remainingForGridAndBottom) break;

      pageRight.push(section);
      rightUsed = nextHeight;
      rightIndex += 1;
    }

    const gridHeight = Math.max(leftUsed, rightUsed);
    usedHeight += gridHeight;

    while (bottomIndex < bottomSections.length) {
      const section = bottomSections[bottomIndex];
      const nextHeight = usedHeight + section.estimatedHeight;

      if (pageBottom.length > 0 && nextHeight > USABLE_HEIGHT) break;
      if (
        pageBottom.length === 0 &&
        (pageIntro.length > 0 ||
          pageFullWidth.length > 0 ||
          pageLeft.length > 0 ||
          pageRight.length > 0) &&
        nextHeight > USABLE_HEIGHT
      ) {
        break;
      }

      pageBottom.push(section);
      usedHeight = nextHeight;
      bottomIndex += 1;
    }

    if (pageIntro.length === 0 && introIndex < introSections.length) {
      pageIntro.push(introSections[introIndex]);
      introIndex += 1;
    }

    if (pageFullWidth.length === 0 && fullWidthIndex < fullWidthSections.length) {
      pageFullWidth.push(fullWidthSections[fullWidthIndex]);
      fullWidthIndex += 1;
    }

    if (pageLeft.length === 0 && leftIndex < lowerLeftSections.length && pageRight.length === 0) {
      pageLeft.push(lowerLeftSections[leftIndex]);
      leftIndex += 1;
    }

    if (pageRight.length === 0 && rightIndex < lowerRightSections.length && pageLeft.length === 0) {
      pageRight.push(lowerRightSections[rightIndex]);
      rightIndex += 1;
    }

    if (
      pageIntro.length > 0 ||
      pageFullWidth.length > 0 ||
      pageLeft.length > 0 ||
      pageRight.length > 0 ||
      pageBottom.length > 0
    ) {
      pages.push({
        introSections: pageIntro,
        fullWidthSections: pageFullWidth,
        lowerLeftSections: pageLeft,
        lowerRightSections: pageRight,
        bottomSections: pageBottom
      });
    } else {
      break;
    }
  }

  return pages;
};

export const buildElegantClassicPages = (
  resume: ResumeData,
  isPdf = false
): ResumePage[] => {
  const accent = resume.editorSettings.accentColor;

  const introSections = createIntroSections(resume, accent);
  const fullWidthSections = createFullWidthSections(resume, accent, isPdf);
  const lowerLeftSections = createLowerLeftSections(resume, accent);
  const lowerRightSections = createLowerRightSections(resume, accent, isPdf);
  const bottomSections = createBottomSections(resume, accent);

  return paginateSections(
    introSections,
    fullWidthSections,
    lowerLeftSections,
    lowerRightSections,
    bottomSections
  );
};

export const ResumeElegantClassic = ({
  resume,
  isPdf = false,
  pageIndex
}: Props) => {
  const pages = buildElegantClassicPages(resume, isPdf);
  const visiblePages =
    typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

  return (
    <>
      {visiblePages.map((page, index) => (
        <div
          key={`resume-elegant-classic-page-${index}`}
          className={`${resumePaperClassName} rounded-none border p-12 font-serif text-slate-900`}
          style={{
            ...resumePaperStyle,
            width: '794px',
            minHeight: '1123px',
            fontSize: `${resume.editorSettings.baseFontSize}px`,
            breakAfter: index === visiblePages.length - 1 ? 'auto' : 'page',
            pageBreakAfter: index === visiblePages.length - 1 ? 'auto' : 'always'
          }}
        >
          {page.introSections.map((section) => (
            <div key={section.key}>{section.content}</div>
          ))}

          {page.fullWidthSections.map((section) => (
            <div key={section.key}>{section.content}</div>
          ))}

          {(page.lowerLeftSections.length > 0 || page.lowerRightSections.length > 0) && (
            <div className="mt-8 grid grid-cols-[1fr_1fr] items-start gap-10">
              <div>
                {page.lowerLeftSections.map((section) => (
                  <div key={section.key}>{section.content}</div>
                ))}
              </div>

              <div>
                {page.lowerRightSections.map((section) => (
                  <div key={section.key}>{section.content}</div>
                ))}
              </div>
            </div>
          )}

          {page.bottomSections.map((section) => (
            <div key={section.key}>{section.content}</div>
          ))}
        </div>
      ))}
    </>
  );
};