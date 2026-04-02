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
  leftSections: PageSection[];
  rightSections: PageSection[];
  bottomSections: PageSection[];
};

const PAGE_HEIGHT = 1123;
const DEFAULT_USABLE_HEIGHT = 1095;
const RELAXED_USABLE_HEIGHT = 1140;

const getVisibleSkills = (resume: ResumeData) =>
  resume.skills.filter(
    (item) => (item.name ?? '').trim().length > 0 && (item.percent ?? 0) > 0
  );

const getVisibleQualities = (resume: ResumeData) =>
  resume.qualities.filter(
    (item) => (item.name ?? '').trim().length > 0 && (item.percent ?? 0) > 0
  );

const getVisibleReferences = (resume: ResumeData) =>
  resume.references.filter((item) =>
    Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

const getVisibleLanguages = (resume: ResumeData) =>
  resume.languages.filter((item) =>
    Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

const getVisibleEducation = (resume: ResumeData) =>
  resume.education.filter(
    (item) =>
      (item.school ?? '').trim().length > 0 ||
      (item.degree ?? '').trim().length > 0 ||
      (item.start ?? '').trim().length > 0 ||
      (item.end ?? '').trim().length > 0
  );

const getVisibleCourses = (resume: ResumeData) =>
  resume.courses.filter((item) =>
    Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

const getVisibleCertificates = (resume: ResumeData) =>
  resume.certificates.filter((item) =>
    Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

const getVisibleAchievements = (resume: ResumeData) =>
  resume.achievements.filter(
    (item) => (item.title ?? '').trim().length > 0 || (item.description ?? '').trim().length > 0
  );

const getVisibleInternships = (resume: ResumeData) =>
  resume.internships.filter((item) =>
    Object.values(item ?? {}).some((value) => {
      if (Array.isArray(value)) {
        return value.some((entry) => String(entry ?? '').trim().length > 0);
      }

      return String(value ?? '').trim().length > 0;
    })
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

const createIntroSections = (resume: ResumeData, accent: string): PageSection[] => {
  const sections: PageSection[] = [];

  sections.push({
    key: 'header',
    estimatedHeight: 145,
    content: (
      <header className="mb-8 border-b pb-6" style={{ borderColor: `${accent}33` }}>
        <div className="flex items-start gap-6">
          <ResumePhotoBlock
            photo={resume.personal.photo}
            alt={resume.personal.fullName}
            sizeClassName="h-20 w-20"
            rounded="rounded-xl"
          />

          <div className="flex-1">
            <h1 className="text-[28px] font-bold">{resume.personal.fullName}</h1>

            {resume.personal.title ? (
              <div className="mt-1" style={{ color: accent }}>
                {resume.personal.title}
              </div>
            ) : null}

            {(resume.personal.email || resume.personal.phone) && (
              <div className="mt-3 text-[12px] text-slate-500">
                {[resume.personal.email, resume.personal.phone].filter(Boolean).join(' | ')}
              </div>
            )}

            {resume.personal.address ? (
              <div className="mt-1 text-[12px] text-slate-500">{resume.personal.address}</div>
            ) : null}
          </div>
        </div>
      </header>
    )
  });

  sections.push({
    key: 'summary',
    estimatedHeight: resume.professionalSummary ? 95 : 18,
    content: <ResumeSummary resume={resume} accent={accent} />
  });

  return sections;
};

const createLeftSections = (
  resume: ResumeData,
  accent: string,
  isPdf: boolean
): PageSection[] => {
  const sections: PageSection[] = [];
  const visibleSkills = getVisibleSkills(resume);
  const visibleQualities = getVisibleQualities(resume);
  const visibleReferences = getVisibleReferences(resume);

  if (visibleSkills.length > 0) {
    sections.push({
      key: 'skills',
      estimatedHeight: 80 + Math.ceil(visibleSkills.length / 2) * 40,
      content: (
        <>
          <ResumeSectionTitleBlock accent={accent}>Skills</ResumeSectionTitleBlock>
          <ResumeSkillGrid skills={visibleSkills} accent={accent} isPdf={isPdf} />
        </>
      )
    });
  }

  if (resume.enabledSections.qualities && visibleQualities.length > 0) {
    sections.push({
      key: 'qualities',
      estimatedHeight: 55 + visibleQualities.length * 36,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeDotPercentageRatings items={visibleQualities} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.references && visibleReferences.length > 0) {
    sections.push({
      key: 'references',
      estimatedHeight: 60 + visibleReferences.length * 52,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeReferencesList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  return sections;
};

const createRightSections = (resume: ResumeData, accent: string): PageSection[] => {
  const sections: PageSection[] = [];
  const visibleEducation = getVisibleEducation(resume);
  const visibleLanguages = getVisibleLanguages(resume);
  const visibleCourses = getVisibleCourses(resume);
  const visibleCertificates = getVisibleCertificates(resume);
  const visibleAchievements = getVisibleAchievements(resume);

  if (visibleEducation.length > 0) {
    sections.push({
      key: 'education',
      estimatedHeight: 90 + visibleEducation.length * 64,
      content: <ResumeEducationList resume={resume} accent={accent} />
    });
  }

  if (visibleLanguages.length > 0) {
    sections.push({
      key: 'languages',
      estimatedHeight: 55 + visibleLanguages.length * 36,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeSectionTitleBlock accent={accent}>Languages</ResumeSectionTitleBlock>
          <ResumeLanguageListBlock resume={resume} />
        </div>
      )
    });
  }

  if (resume.enabledSections.courses && visibleCourses.length > 0) {
    sections.push({
      key: 'courses',
      estimatedHeight: 70 + visibleCourses.length * 52,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeCoursesList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.certificates && visibleCertificates.length > 0) {
    sections.push({
      key: 'certificates',
      estimatedHeight: 70 + visibleCertificates.length * 52,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeCertificatesList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.achievements && visibleAchievements.length > 0) {
    sections.push({
      key: 'achievements',
      estimatedHeight: 70 + visibleAchievements.length * 52,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeAchievementsList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  return sections;
};

const createBottomSections = (
  resume: ResumeData,
  accent: string,
  isPdf: boolean
): PageSection[] => {
  const sections: PageSection[] = [];
  const visibleExperience = getVisibleExperience(resume);
  const visibleInternships = getVisibleInternships(resume);

  if (visibleExperience.length > 0) {
    sections.push({
      key: 'experience',
      estimatedHeight:
        70 +
        visibleExperience.reduce((total, item) => {
          const bulletCount = item.bullets.filter((bullet) => bullet.trim().length > 0).length;
          return total + 60 + bulletCount * 16;
        }, 0),
      content: (
        <div className="mt-8">
          <ResumeExperienceList resume={resume} accent={accent} compact isPdf={isPdf} />
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
  introSections: PageSection[],
  leftSections: PageSection[],
  rightSections: PageSection[],
  bottomSections: PageSection[],
  usableHeight: number
): ResumePage[] => {
  const pages: ResumePage[] = [];

  let introIndex = 0;
  let leftIndex = 0;
  let rightIndex = 0;
  let bottomIndex = 0;

  while (
    introIndex < introSections.length ||
    leftIndex < leftSections.length ||
    rightIndex < rightSections.length ||
    bottomIndex < bottomSections.length
  ) {
    let usedHeight = 0;

    const pageIntro: PageSection[] = [];
    const pageLeft: PageSection[] = [];
    const pageRight: PageSection[] = [];
    const pageBottom: PageSection[] = [];

    while (introIndex < introSections.length) {
      const section = introSections[introIndex];
      const nextHeight = usedHeight + section.estimatedHeight;

      if (pageIntro.length > 0 && nextHeight > usableHeight) break;

      pageIntro.push(section);
      usedHeight = nextHeight;
      introIndex += 1;
    }

    const remainingForGridAndBottom = Math.max(usableHeight - usedHeight, 0);

    let leftUsed = 0;
    let rightUsed = 0;

    while (leftIndex < leftSections.length) {
      const section = leftSections[leftIndex];
      const nextHeight = leftUsed + section.estimatedHeight;

      if (pageLeft.length > 0 && nextHeight > remainingForGridAndBottom) break;

      pageLeft.push(section);
      leftUsed = nextHeight;
      leftIndex += 1;
    }

    while (rightIndex < rightSections.length) {
      const section = rightSections[rightIndex];
      const nextHeight = rightUsed + section.estimatedHeight;

      if (pageRight.length > 0 && nextHeight > remainingForGridAndBottom) break;

      pageRight.push(section);
      rightUsed = nextHeight;
      rightIndex += 1;
    }

    const gridHeight =
      pageLeft.length > 0 || pageRight.length > 0 ? Math.max(leftUsed, rightUsed) + 32 : 0;

    usedHeight += gridHeight;

    while (bottomIndex < bottomSections.length) {
      const section = bottomSections[bottomIndex];
      const nextHeight = usedHeight + section.estimatedHeight;

      if (pageBottom.length > 0 && nextHeight > usableHeight) break;

      if (
        pageBottom.length === 0 &&
        (pageIntro.length > 0 || pageLeft.length > 0 || pageRight.length > 0) &&
        nextHeight > usableHeight
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

    if (pageLeft.length === 0 && leftIndex < leftSections.length && pageRight.length === 0) {
      pageLeft.push(leftSections[leftIndex]);
      leftIndex += 1;
    }

    if (pageRight.length === 0 && rightIndex < rightSections.length && pageLeft.length === 0) {
      pageRight.push(rightSections[rightIndex]);
      rightIndex += 1;
    }

    if (pageBottom.length === 0 && bottomIndex < bottomSections.length) {
      pageBottom.push(bottomSections[bottomIndex]);
      bottomIndex += 1;
    }

    if (
      pageIntro.length > 0 ||
      pageLeft.length > 0 ||
      pageRight.length > 0 ||
      pageBottom.length > 0
    ) {
      pages.push({
        introSections: pageIntro,
        leftSections: pageLeft,
        rightSections: pageRight,
        bottomSections: pageBottom
      });
    } else {
      break;
    }
  }

  return pages;
};

export const buildTechCleanPages = (
  resume: ResumeData,
  isPdf = false
): ResumePage[] => {
  const accent = resume.editorSettings.accentColor;

  const introSections = createIntroSections(resume, accent);
  const leftSections = createLeftSections(resume, accent, isPdf);
  const rightSections = createRightSections(resume, accent);
  const bottomSections = createBottomSections(resume, accent, isPdf);

  const defaultPages = paginateSections(
    introSections,
    leftSections,
    rightSections,
    bottomSections,
    DEFAULT_USABLE_HEIGHT
  );

  if (defaultPages.length === 1) {
    return defaultPages;
  }

  return paginateSections(
    introSections,
    leftSections,
    rightSections,
    bottomSections,
    RELAXED_USABLE_HEIGHT
  );
};

export const ResumeTechClean = ({
  resume,
  isPdf = false,
  pageIndex
}: Props) => {
  const accent = resume.editorSettings.accentColor;
  const pages = buildTechCleanPages(resume, isPdf);
  const visiblePages =
    typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

  return (
    <>
      {visiblePages.map((page, index) => (
        <div
          key={`resume-tech-clean-page-${index}`}
          className={`${resumePaperClassName} rounded-none p-10 font-mono text-slate-900`}
          style={{
            ...resumePaperStyle,
            width: '794px',
            minHeight: `${PAGE_HEIGHT}px`,
            fontSize: `${Math.max(12, resume.editorSettings.baseFontSize - 1)}px`,
            breakAfter: index === visiblePages.length - 1 ? 'auto' : 'page',
            pageBreakAfter: index === visiblePages.length - 1 ? 'auto' : 'always'
          }}
        >
          {page.introSections.map((section) => (
            <div key={section.key}>{section.content}</div>
          ))}

          {(page.leftSections.length > 0 || page.rightSections.length > 0) && (
            <div className="mt-8 grid grid-cols-[1fr_1fr] items-start gap-8">
              <div>
                {page.leftSections.map((section) => (
                  <div key={section.key}>{section.content}</div>
                ))}
              </div>

              <div>
                {page.rightSections.map((section) => (
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