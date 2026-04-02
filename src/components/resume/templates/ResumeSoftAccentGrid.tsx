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

const getVisibleSkills = (resume: ResumeData) =>
  resume.skills.filter(
    (skill) => (skill.name ?? '').trim().length > 0 && (skill.percent ?? 0) > 0
  );

const getVisibleLanguages = (resume: ResumeData) =>
  resume.languages.filter((item) =>
    Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

const getVisibleReferences = (resume: ResumeData) =>
  resume.references.filter((item) =>
    Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
  );

const getVisibleQualities = (resume: ResumeData) =>
  resume.qualities.filter(
    (item) => (item.name ?? '').trim().length > 0 && (item.percent ?? 0) > 0
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

const getVisibleInternships = (resume: ResumeData) =>
  resume.internships.filter((item) =>
    Object.values(item ?? {}).some((value) => {
      if (Array.isArray(value)) {
        return value.some((entry) => String(entry ?? '').trim().length > 0);
      }
      return String(value ?? '').trim().length > 0;
    })
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

const createSidebarSections = (resume: ResumeData, accent: string): PageSection[] => {
  const references = getVisibleReferences(resume);
  const languages = getVisibleLanguages(resume);
  const sections: PageSection[] = [];

  sections.push({
    key: 'profile',
    estimatedHeight: 150,
    content: (
      <div className="flex flex-col items-center">
        <ResumePhotoBlock
          photo={resume.personal.photo}
          alt={resume.personal.fullName}
          sizeClassName="h-24 w-24"
          rounded="rounded-2xl"
        />
        <h1 className="mt-4 w-full text-center text-[20px] font-bold text-slate-900">
          {resume.personal.fullName}
        </h1>
        {resume.personal.title ? (
          <p className="mt-1 w-full text-center text-sm" style={{ color: accent }}>
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
      <div className="mt-7">
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
        <div className="mt-7">
          <ResumeSectionTitleBlock accent={accent}>Languages</ResumeSectionTitleBlock>
          <ResumeLanguageListBlock resume={resume} />
        </div>
      )
    });
  }

  if (resume.enabledSections.references && references.length > 0) {
    sections.push({
      key: 'references',
      estimatedHeight: 60 + references.length * 52,
      content: (
        <div className="mt-7">
          <ResumeReferencesList resume={resume} accent={accent} />
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
  const experience = getVisibleExperience(resume);
  const internships = getVisibleInternships(resume);
  const activities = getVisibleActivities(resume);
  const skills = getVisibleSkills(resume);
  const qualities = getVisibleQualities(resume);
  const education = getVisibleEducation(resume);
  const courses = getVisibleCourses(resume);
  const certificates = getVisibleCertificates(resume);
  const achievements = getVisibleAchievements(resume);

  const sections: PageSection[] = [];

  sections.push({
    key: 'summary',
    estimatedHeight: resume.professionalSummary ? 95 : 18,
    content: <ResumeSummary resume={resume} accent={accent} />
  });

  const leftEstimated =
    (experience.length > 0
      ? 70 +
        experience.reduce((total, item) => {
          const bulletCount = item.bullets.filter((bullet) => bullet.trim().length > 0).length;
          return total + 60 + bulletCount * 16;
        }, 0)
      : 0) +
    (resume.enabledSections.internships && internships.length > 0
      ? 70 + internships.length * 78 + 24
      : 0) +
    (resume.enabledSections.extracurricularActivities && activities.length > 0
      ? 70 + activities.length * 34 + 24
      : 0);

  const rightEstimated =
    (skills.length > 0 ? 80 + Math.ceil(skills.length / 2) * 40 : 0) +
    (resume.enabledSections.qualities && qualities.length > 0 ? 55 + qualities.length * 36 + 24 : 0) +
    (education.length > 0 ? 90 + education.length * 64 + 24 : 0) +
    (resume.enabledSections.courses && courses.length > 0 ? 70 + courses.length * 52 + 24 : 0) +
    (resume.enabledSections.certificates && certificates.length > 0
      ? 70 + certificates.length * 52 + 24
      : 0) +
    (resume.enabledSections.achievements && achievements.length > 0
      ? 70 + achievements.length * 52 + 24
      : 0);

  sections.push({
    key: 'content-grid',
    estimatedHeight: Math.max(leftEstimated, rightEstimated, 60) + 20,
    content: (
      <div className="mt-8 grid grid-cols-[1.2fr_0.8fr] items-start gap-10">
        <div>
          {experience.length > 0 ? (
            <ResumeExperienceList resume={resume} accent={accent} compact isPdf={isPdf} />
          ) : null}

          {resume.enabledSections.internships && internships.length > 0 ? (
            <div className="mt-8">
              <ResumeInternshipsList resume={resume} accent={accent} />
            </div>
          ) : null}

          {resume.enabledSections.extracurricularActivities && activities.length > 0 ? (
            <div className="mt-8">
              <ResumeStringSection
                title="Extracurricular Activities"
                items={activities}
                accent={accent}
              />
            </div>
          ) : null}
        </div>

        <div>
          {skills.length > 0 ? (
            <>
              <ResumeSectionTitleBlock accent={accent}>Skills</ResumeSectionTitleBlock>
              <ResumeSkillGrid skills={skills} accent={accent} isPdf={isPdf} />
            </>
          ) : null}

          {resume.enabledSections.qualities && qualities.length > 0 ? (
            <div className="mt-8">
              <ResumeDotPercentageRatings items={qualities} accent={accent} />
            </div>
          ) : null}

          {education.length > 0 ? (
            <div className="mt-8">
              <ResumeEducationList resume={resume} accent={accent} />
            </div>
          ) : null}

          {resume.enabledSections.courses && courses.length > 0 ? (
            <div className="mt-8">
              <ResumeCoursesList resume={resume} accent={accent} />
            </div>
          ) : null}

          {resume.enabledSections.certificates && certificates.length > 0 ? (
            <div className="mt-8">
              <ResumeCertificatesList resume={resume} accent={accent} />
            </div>
          ) : null}

          {resume.enabledSections.achievements && achievements.length > 0 ? (
            <div className="mt-8">
              <ResumeAchievementsList resume={resume} accent={accent} />
            </div>
          ) : null}
        </div>
      </div>
    )
  });

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

export const buildSoftAccentGridPages = (
  resume: ResumeData,
  isPdf = false
): ResumePage[] => {
  const accent = resume.editorSettings.accentColor;
  const sidebarSections = createSidebarSections(resume, accent);
  const mainSections = createMainSections(resume, accent, isPdf);

  const defaultPages = paginateSections(sidebarSections, mainSections, DEFAULT_USABLE_HEIGHT);
  if (defaultPages.length === 1) return defaultPages;

  return paginateSections(sidebarSections, mainSections, RELAXED_USABLE_HEIGHT);
};

export const ResumeSoftAccentGrid = ({
  resume,
  isPdf = false,
  pageIndex
}: Props) => {
  const accent = resume.editorSettings.accentColor;
  const pages = buildSoftAccentGridPages(resume, isPdf);
  const visiblePages =
    typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

  return (
    <>
      {visiblePages.map((page, index) => (
        <div
          key={`resume-soft-accent-grid-page-${index}`}
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
              gridTemplateColumns: '210px 1fr',
              minHeight: `${PAGE_HEIGHT}px`
            }}
          >
            <aside
              className="border-r p-7"
              style={{
                background: `${accent}0D`,
                borderColor: `${accent}22`,
                minHeight: `${PAGE_HEIGHT}px`
              }}
            >
              {page.sidebarSections.map((section) => (
                <div key={section.key}>{section.content}</div>
              ))}
            </aside>

            <main className="p-8 text-slate-800">
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