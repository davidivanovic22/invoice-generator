import type { ReactNode } from 'react';
import { ResumeData } from '../../../types/resume';
import { ResumeContactListBlock } from '../blocks/ResumeContactListBlock';
import { ResumeLanguageListBlock } from '../blocks/ResumeLanguageListBlock';
import { ResumePhotoBlock } from '../blocks/ResumePhotoBlock';
import { ResumeSectionTitleBlock } from '../blocks/ResumeSectionTitleBlock';
import {
  ResumeAchievementsList,
  ResumeEducationList,
  ResumeFooterText,
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
  heroSections: PageSection[];
  sidebarSections: PageSection[];
  mainSections: PageSection[];
};

const PAGE_HEIGHT = 1123;
const HERO_HEIGHT = 190;
const USABLE_BODY_HEIGHT = 850;

const SLATE = '#2c4e7d';
const SLATE_DARK = '#243f66';
const SLATE_SOFT = '#dce6f4';
const PAPER = '#f8fbff';
const MAIN_TEXT = '#1f2937';

const createVisibleSkills = (resume: ResumeData) =>
  resume.skills
    .filter((skill) => (skill.name ?? '').trim().length > 0)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
    .slice(0, 8);

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

const createHeroSection = (resume: ResumeData): PageSection => ({
  key: 'hero',
  estimatedHeight: HERO_HEIGHT,
  content: (
    <section className="bg-[#f8fbff] px-12 pb-8 pt-10">
      <div className="grid grid-cols-[190px_1fr] gap-10">
        <div className="relative flex justify-center">
          <div className="relative h-[142px] w-[142px] rounded-full bg-[#2c4e7d] p-[7px] shadow-[0_10px_30px_rgba(36,63,102,0.18)]">
            <div className="h-full w-full rounded-full border-[3px] border-white/70 p-[4px]">
              <ResumePhotoBlock
                photo={resume.personal.photo}
                alt={resume.personal.fullName}
                rounded="rounded-full"
                sizeClassName="h-full w-full"
              />
            </div>
          </div>
        </div>

        <div className="flex min-h-[142px] flex-col justify-center">
          <div className="inline-flex w-fit items-center rounded-full border border-[#2c4e7d]/20 bg-[#eef4fb] px-4 py-1 text-[11px] font-bold uppercase tracking-[0.28em] text-[#2c4e7d]">
            Resume Profile
          </div>

          <h1 className="mt-4 text-[38px] font-extrabold uppercase leading-none tracking-[0.08em] text-[#243047]">
            {resume.personal.fullName}
          </h1>

          <div className="mt-3 text-[17px] font-medium uppercase tracking-[0.18em] text-[#5b6b81]">
            {resume.personal.title}
          </div>

          <div className="mt-6 h-px w-full bg-[#d9e5f2]" />
        </div>
      </div>
    </section>
  )
});

const createSidebarSections = (
  resume: ResumeData,
  accent: string,
  isPdf: boolean
): PageSection[] => {
  const visibleSkills = createVisibleSkills(resume);
  const sections: PageSection[] = [];

  if (resume.professionalSummary?.trim()) {
    sections.push({
      key: 'summary',
      estimatedHeight: 125,
      content: (
        <div>
          <ResumeSummary resume={resume} accent={accent} light />
        </div>
      )
    });
  }

  if (resume.education.length > 0) {
    sections.push({
      key: 'education',
      estimatedHeight: 85 + resume.education.length * 70,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeEducationList resume={resume} accent={accent} light />
        </div>
      )
    });
  }

  if (visibleSkills.length > 0) {
    sections.push({
      key: 'skills',
      estimatedHeight: 95 + visibleSkills.length * 26,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeSectionTitleBlock accent={accent} light>
            Skills
          </ResumeSectionTitleBlock>

          <div className="space-y-3">
            {visibleSkills.map((skill) => {
              const percent = Math.max(0, Math.min(skill.percent ?? 0, 100));

              return (
                <div key={skill.id}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-white/90">{skill.name}</span>
                    <span className="text-[11px] font-bold text-white/65">{percent}%</span>
                  </div>

                  <div className="h-2 rounded-full bg-white/15">
                    <div
                      className="h-2 rounded-full bg-white"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )
    });
  }

  if (resume.languages.length > 0) {
    sections.push({
      key: 'languages',
      estimatedHeight: 55 + resume.languages.length * 42,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeSectionTitleBlock accent={accent} light>
            Languages
          </ResumeSectionTitleBlock>

          <ResumeLanguageListBlock resume={resume} light />
        </div>
      )
    });
  }

  sections.push({
    key: 'contact',
    estimatedHeight: 130,
    content: (
      <div className={sections.length > 0 ? 'mt-8' : ''}>
        <ResumeSectionTitleBlock accent={accent} light>
          Contact
        </ResumeSectionTitleBlock>

        <ResumeContactListBlock resume={resume} light />
      </div>
    )
  });

  return sections;
};

const createMainSections = (resume: ResumeData, accent: string): PageSection[] => {
  const visibleExperience = createVisibleExperience(resume);
  const visibleAchievements = createVisibleAchievements(resume);

  const sections: PageSection[] = [];

  if (visibleExperience.length > 0) {
    sections.push({
      key: 'experience',
      estimatedHeight:
        85 +
        visibleExperience.reduce((total, exp) => {
          const bulletsCount = exp.bullets.filter((bullet) => bullet.trim().length > 0).length;
          return total + 96 + bulletsCount * 20;
        }, 0),
      content: (
        <section>
          <ResumeSectionTitleBlock accent={accent}>Professional Experience</ResumeSectionTitleBlock>

          <div className="space-y-8">
            {visibleExperience.map((exp, index) => (
              <article
                key={exp.id}
                className={`rounded-[28px] border bg-white px-6 py-5 shadow-[0_8px_30px_rgba(36,63,102,0.06)] ${
                  index !== 0 ? '' : ''
                }`}
                style={{ borderColor: '#dbe7f3' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[20px] font-bold text-slate-900">{exp.role}</div>
                    <div className="mt-1 text-[14px] font-semibold text-slate-600">
                      {[exp.company, exp.project, exp.location].filter(Boolean).join(' • ')}
                    </div>
                  </div>

                  <div
                    className="shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
                    style={{
                      backgroundColor: '#eef4fb',
                      color: accent
                    }}
                  >
                    {[exp.start, exp.end].filter(Boolean).join(' — ')}
                  </div>
                </div>

                {exp.bullets.some((bullet) => bullet.trim().length > 0) ? (
                  <ul className="mt-4 space-y-2.5 pl-5 text-[14px] leading-6 text-slate-700">
                    {exp.bullets
                      .filter((bullet) => bullet.trim().length > 0)
                      .map((bullet, bulletIndex) => (
                        <li key={`${exp.id}-bullet-${bulletIndex}`}>{bullet}</li>
                      ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )
    });
  }

  if (resume.enabledSections.achievements && visibleAchievements.length > 0) {
    sections.push({
      key: 'achievements',
      estimatedHeight: 70 + visibleAchievements.length * 72,
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
      estimatedHeight: 72,
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
  heroSections: PageSection[],
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

    pages.push({
      heroSections: isFirstPage ? heroSections : [],
      sidebarSections: pageSidebar,
      mainSections: pageMain
    });

    isFirstPage = false;

    if (sidebarIndex >= sidebarSections.length && mainIndex >= mainSections.length && !isFirstPage) {
      break;
    }
  }

  return pages;
};

export const buildExecutiveSlatePages = (
  resume: ResumeData,
  isPdf = false
): ResumePage[] => {
  const accent = resume.editorSettings.accentColor || SLATE;
  const heroSections = [createHeroSection(resume)];
  const sidebarSections = createSidebarSections(resume, accent, isPdf);
  const mainSections = createMainSections(resume, accent);

  return paginateSections(heroSections, sidebarSections, mainSections);
};

export const ResumeExecutiveSlate = ({
  resume,
  isPdf = false,
  pageIndex
}: Props) => {
  const pages = buildExecutiveSlatePages(resume, isPdf);
  const visiblePages =
    typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

  return (
    <>
      {visiblePages.map((page, index) => (
        <div
          key={`resume-executive-slate-page-${index}`}
          data-pdf-page="true"
          className={`${resumePaperClassName} rounded-none bg-[#f8fbff]`}
          style={{
            ...resumePaperStyle,
            width: '794px',
            minHeight: `${PAGE_HEIGHT}px`,
            fontSize: `${resume.editorSettings.baseFontSize}px`,
            breakAfter: index === visiblePages.length - 1 ? 'auto' : 'page',
            pageBreakAfter: index === visiblePages.length - 1 ? 'auto' : 'always'
          }}
        >
          {page.heroSections.map((section) => (
            <div key={section.key}>{section.content}</div>
          ))}

          <div
            className="grid"
            style={{
              gridTemplateColumns: '285px 1fr',
              minHeight: page.heroSections.length > 0 ? `${PAGE_HEIGHT - HERO_HEIGHT}px` : `${PAGE_HEIGHT}px`
            }}
          >
            <aside className="relative bg-[#24406c] px-7 pb-10 pt-8 text-white">
              <div className="absolute bottom-0 right-0 top-0 w-[18px] bg-[#24406c]" />
              <div className="relative rounded-[34px] bg-[#2e4f82] px-6 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <div
                  className="absolute -right-[22px] bottom-0 top-0 w-[44px] rounded-r-[28px] bg-[#2e4f82]"
                  aria-hidden="true"
                />
                <div className="relative z-[1]">
                  {page.sidebarSections.map((section) => (
                    <div key={section.key}>{section.content}</div>
                  ))}
                </div>
              </div>
            </aside>

            <main className="bg-[#f8fbff] px-10 pb-10 pt-8">
              <div
                className="mb-8 h-px w-full"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(44,78,125,0.25) 0%, rgba(44,78,125,0.08) 55%, rgba(44,78,125,0) 100%)'
                }}
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