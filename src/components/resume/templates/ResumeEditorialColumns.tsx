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
  mainSections: PageSection[];
  sidebarSections: PageSection[];
};

const PAGE_HEIGHT = 1123;
const DEFAULT_USABLE_HEIGHT = 1095;
const RELAXED_USABLE_HEIGHT = 1140;

const visibleSkills = (resume: ResumeData) =>
  resume.skills.filter((item) => (item.name ?? '').trim().length > 0 && (item.percent ?? 0) > 0);

const visibleLanguages = (resume: ResumeData) =>
  resume.languages.filter((item) =>
    Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

const visibleQualities = (resume: ResumeData) =>
  resume.qualities.filter((item) => (item.name ?? '').trim().length > 0 && (item.percent ?? 0) > 0);

const visibleReferences = (resume: ResumeData) =>
  resume.references.filter((item) =>
    Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

const visibleCertificates = (resume: ResumeData) =>
  resume.certificates.filter((item) =>
    Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

const visibleAchievements = (resume: ResumeData) =>
  resume.achievements.filter(
    (item) => (item.title ?? '').trim().length > 0 || (item.description ?? '').trim().length > 0
  );

const visibleActivities = (resume: ResumeData) =>
  resume.extracurricularActivities.filter((item) => String(item ?? '').trim().length > 0);

const visibleEducation = (resume: ResumeData) =>
  resume.education.filter(
    (item) =>
      (item.school ?? '').trim().length > 0 ||
      (item.degree ?? '').trim().length > 0 ||
      (item.start ?? '').trim().length > 0 ||
      (item.end ?? '').trim().length > 0
  );

const visibleCourses = (resume: ResumeData) =>
  resume.courses.filter((item) =>
    Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

const visibleInternships = (resume: ResumeData) =>
  resume.internships.filter((item) =>
    Object.values(item ?? {}).some((value) => {
      if (Array.isArray(value)) {
        return value.some((entry) => String(entry ?? '').trim().length > 0);
      }
      return String(value ?? '').trim().length > 0;
    })
  );

const visibleExperience = (resume: ResumeData) =>
  resume.experience.filter(
    (item) =>
      (item.role ?? '').trim().length > 0 ||
      (item.company ?? '').trim().length > 0 ||
      (item.project ?? '').trim().length > 0 ||
      (item.location ?? '').trim().length > 0 ||
      item.bullets.some((bullet) => bullet.trim().length > 0)
  );

const createMainSections = (
  resume: ResumeData,
  accent: string,
  isPdf: boolean
): PageSection[] => {
  const sections: PageSection[] = [];
  const education = visibleEducation(resume);
  const skills = visibleSkills(resume);
  const courses = visibleCourses(resume);

  sections.push({
    key: 'header',
    estimatedHeight: 90,
    content: (
      <>
        <h1 className="text-[34px] font-bold leading-tight text-slate-900">
          {resume.personal.fullName}
        </h1>
        {resume.personal.title ? (
          <p className="mt-2 text-[18px]" style={{ color: accent }}>
            {resume.personal.title}
          </p>
        ) : null}
      </>
    )
  });

  sections.push({
    key: 'summary',
    estimatedHeight: resume.professionalSummary ? 95 : 18,
    content: (
      <div className="mt-8">
        <ResumeSummary resume={resume} accent={accent} />
      </div>
    )
  });

  const experience = visibleExperience(resume);
  if (experience.length > 0) {
    sections.push({
      key: 'experience',
      estimatedHeight:
        70 +
        experience.reduce((total, item) => {
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

  const internships = visibleInternships(resume);
  if (resume.enabledSections.internships && internships.length > 0) {
    sections.push({
      key: 'internships',
      estimatedHeight: 70 + internships.length * 78,
      content: (
        <div className="mt-8">
          <ResumeInternshipsList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (education.length > 0 || skills.length > 0) {
    sections.push({
      key: 'middle-grid',
      estimatedHeight: Math.max(
        education.length > 0 ? 90 + education.length * 64 : 0,
        skills.length > 0 ? 80 + Math.ceil(skills.length / 2) * 40 : 0,
        60
      ) + 24,
      content: (
        <div className="mt-8 grid grid-cols-2 gap-10">
          <div>{education.length > 0 ? <ResumeEducationList resume={resume} accent={accent} /> : null}</div>
          <div>
            {skills.length > 0 ? (
              <>
                <ResumeSectionTitleBlock accent={accent}>Skills</ResumeSectionTitleBlock>
                <ResumeSkillGrid skills={skills} accent={accent} isPdf={isPdf} />
              </>
            ) : null}
          </div>
        </div>
      )
    });
  }

  if (resume.enabledSections.courses && courses.length > 0) {
    sections.push({
      key: 'courses',
      estimatedHeight: 70 + courses.length * 52,
      content: (
        <div className="mt-8">
          <ResumeCoursesList resume={resume} accent={accent} />
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

const createSidebarSections = (resume: ResumeData, accent: string): PageSection[] => {
  const sections: PageSection[] = [];
  const languages = visibleLanguages(resume);
  const qualities = visibleQualities(resume);
  const references = visibleReferences(resume);
  const certificates = visibleCertificates(resume);
  const achievements = visibleAchievements(resume);
  const activities = visibleActivities(resume);

  sections.push({
    key: 'photo',
    estimatedHeight: 120,
    content: (
      <div className="flex flex-col items-center">
        <ResumePhotoBlock
          photo={resume.personal.photo}
          alt={resume.personal.fullName}
          sizeClassName="h-24 w-24"
          rounded="rounded-full"
        />
      </div>
    )
  });

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

  if (languages.length > 0) {
    sections.push({
      key: 'languages',
      estimatedHeight: 55 + languages.length * 36,
      content: (
        <div className="mt-8">
          <ResumeSectionTitleBlock accent={accent}>Languages</ResumeSectionTitleBlock>
          <ResumeLanguageListBlock resume={resume} />
        </div>
      )
    });
  }

  if (resume.enabledSections.qualities && qualities.length > 0) {
    sections.push({
      key: 'qualities',
      estimatedHeight: 55 + qualities.length * 36,
      content: (
        <div className="mt-8">
          <ResumeDotPercentageRatings items={qualities} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.references && references.length > 0) {
    sections.push({
      key: 'references',
      estimatedHeight: 60 + references.length * 52,
      content: (
        <div className="mt-8">
          <ResumeReferencesList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.certificates && certificates.length > 0) {
    sections.push({
      key: 'certificates',
      estimatedHeight: 70 + certificates.length * 52,
      content: (
        <div className="mt-8">
          <ResumeCertificatesList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.achievements && achievements.length > 0) {
    sections.push({
      key: 'achievements',
      estimatedHeight: 70 + achievements.length * 52,
      content: (
        <div className="mt-8">
          <ResumeAchievementsList resume={resume} accent={accent} />
        </div>
      )
    });
  }

  if (resume.enabledSections.extracurricularActivities && activities.length > 0) {
    sections.push({
      key: 'activities',
      estimatedHeight: 70 + activities.length * 34,
      content: (
        <div className="mt-8">
          <ResumeStringSection
            title="Extracurricular Activities"
            items={activities}
            accent={accent}
          />
        </div>
      )
    });
  }

  if (resume.enabledSections.signature && resume.signature) {
    sections.push({
      key: 'signature',
      estimatedHeight: 75,
      content: (
        <div className="mt-8">
          <ResumeFooterText title="Signature" value={resume.signature} accent={accent} />
        </div>
      )
    });
  }

  return sections;
};

const paginateSections = (
  mainSections: PageSection[],
  sidebarSections: PageSection[],
  usableHeight: number
): ResumePage[] => {
  const pages: ResumePage[] = [];
  let mainIndex = 0;
  let sidebarIndex = 0;

  while (mainIndex < mainSections.length || sidebarIndex < sidebarSections.length) {
    let mainUsed = 0;
    let sidebarUsed = 0;
    const pageMain: PageSection[] = [];
    const pageSidebar: PageSection[] = [];

    while (mainIndex < mainSections.length) {
      const section = mainSections[mainIndex];
      const nextHeight = mainUsed + section.estimatedHeight;
      if (pageMain.length > 0 && nextHeight > usableHeight) break;
      pageMain.push(section);
      mainUsed = nextHeight;
      mainIndex += 1;
    }

    while (sidebarIndex < sidebarSections.length) {
      const section = sidebarSections[sidebarIndex];
      const nextHeight = sidebarUsed + section.estimatedHeight;
      if (pageSidebar.length > 0 && nextHeight > usableHeight) break;
      pageSidebar.push(section);
      sidebarUsed = nextHeight;
      sidebarIndex += 1;
    }

    if (pageMain.length === 0 && mainIndex < mainSections.length) {
      pageMain.push(mainSections[mainIndex]);
      mainIndex += 1;
    }

    if (pageSidebar.length === 0 && sidebarIndex < sidebarSections.length) {
      pageSidebar.push(sidebarSections[sidebarIndex]);
      sidebarIndex += 1;
    }

    if (pageMain.length > 0 || pageSidebar.length > 0) {
      pages.push({ mainSections: pageMain, sidebarSections: pageSidebar });
    } else {
      break;
    }
  }

  return pages;
};

export const buildEditorialColumnsPages = (
  resume: ResumeData,
  isPdf = false
): ResumePage[] => {
  const accent = resume.editorSettings.accentColor;
  const mainSections = createMainSections(resume, accent, isPdf);
  const sidebarSections = createSidebarSections(resume, accent);

  const defaultPages = paginateSections(mainSections, sidebarSections, DEFAULT_USABLE_HEIGHT);
  if (defaultPages.length === 1) return defaultPages;

  return paginateSections(mainSections, sidebarSections, RELAXED_USABLE_HEIGHT);
};

export const ResumeEditorialColumns = ({
  resume,
  isPdf = false,
  pageIndex
}: Props) => {
  const accent = resume.editorSettings.accentColor;
  const pages = buildEditorialColumnsPages(resume, isPdf);
  const visiblePages =
    typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

  return (
    <>
      {visiblePages.map((page, index) => (
        <div
          key={`resume-editorial-columns-page-${index}`}
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
              gridTemplateColumns: '1.1fr 0.55fr',
              minHeight: `${PAGE_HEIGHT}px`
            }}
          >
            <main className="p-10 text-slate-800">
              {page.mainSections.map((section) => (
                <div key={section.key}>{section.content}</div>
              ))}
            </main>

            <aside
              className="border-l p-8"
              style={{
                borderColor: `${accent}22`,
                background: '#fafaf9',
                minHeight: `${PAGE_HEIGHT}px`
              }}
            >
              {page.sidebarSections.map((section) => (
                <div key={section.key}>{section.content}</div>
              ))}
            </aside>
          </div>
        </div>
      ))}
    </>
  );
};