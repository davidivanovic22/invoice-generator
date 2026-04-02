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
  heroSections: PageSection[];
  sidebarSections: PageSection[];
  mainSections: PageSection[];
};

const PAGE_HEIGHT = 1123;
const HERO_HEIGHT = 280;
const USABLE_BODY_HEIGHT = 760;

const GOLD = '#c9a24f';
const GOLD_SOFT = '#e9d3a2';
const DARK = '#111214';
const DARK_SOFT = '#191b20';
const PANEL = '#17191d';

const createVisibleSkills = (resume: ResumeData) =>
  resume.skills
    .filter((skill) => (skill.name ?? '').trim().length > 0 && (skill.percent ?? 0) > 0)
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
    <section className="relative overflow-hidden bg-[#111214] px-12 pb-10 pt-10 text-white">
      <div
        className="absolute left-0 top-0 h-[14px] w-full"
        style={{
          background:
            'linear-gradient(90deg, #7d5a1f 0%, #c9a24f 30%, #f1e0b5 50%, #c9a24f 70%, #7d5a1f 100%)'
        }}
      />

      <div className="grid grid-cols-[190px_1fr] gap-10">
        <div className="flex justify-center">
          <div className="rounded-full border-[3px] p-[10px]" style={{ borderColor: GOLD }}>
            <ResumePhotoBlock
              photo={resume.personal.photo}
              alt={resume.personal.fullName}
              rounded="rounded-full"
              sizeClassName="h-[150px] w-[150px]"
              light
            />
          </div>
        </div>

        <div className="pt-3">
          <div
            className="mb-4 inline-block border px-4 py-1 text-[11px] font-bold uppercase tracking-[0.32em]"
            style={{
              borderColor: 'rgba(201,162,79,0.55)',
              color: GOLD_SOFT
            }}
          >
            Curriculum Vitae
          </div>

          <h1 className="text-[38px] font-extrabold uppercase leading-none tracking-[0.08em] text-white">
            {resume.personal.fullName}
          </h1>

          <div className="mt-4 text-[18px] font-medium tracking-[0.16em] text-[#f0e1bc]">
            {resume.personal.title}
          </div>

          <div className="mt-6 h-px w-full bg-white/10" />

          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-2 text-[12px] text-white/75">
            {[resume.personal.email, resume.personal.phone, resume.personal.website, resume.personal.address]
              .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
              .slice(0, 4)
              .map((item, index) => (
                <div key={`${item}-${index}`} className="break-words">
                  {item}
                </div>
              ))}
          </div>
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
      estimatedHeight: 130,
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
      estimatedHeight: 85 + resume.education.length * 72,
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
      estimatedHeight: 75 + Math.ceil(visibleSkills.length / 2) * 42,
      content: (
        <div className={sections.length > 0 ? 'mt-8' : ''}>
          <ResumeSectionTitleBlock accent={accent} light>
            Core Skills
          </ResumeSectionTitleBlock>

          <ResumeSkillGrid
            skills={visibleSkills}
            accent={accent}
            isPdf={isPdf}
            showPercent={true}
            light
          />
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
          return total + 86 + bulletsCount * 20;
        }, 0),
      content: (
        <section>
          <ResumeSectionTitleBlock accent={accent}>Experience</ResumeSectionTitleBlock>

          <div className="space-y-8">
            {visibleExperience.map((exp) => (
              <article
                key={exp.id}
                className="relative border-l pl-6"
                style={{ borderColor: 'rgba(201,162,79,0.35)' }}
              >
                <span
                  className="absolute -left-[7px] top-[5px] h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: accent }}
                />

                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[18px] font-bold text-slate-900">{exp.role}</div>
                    <div className="mt-1 text-[14px] font-semibold text-slate-600">
                      {[exp.company, exp.project, exp.location].filter(Boolean).join(' • ')}
                    </div>
                  </div>

                  <div className="shrink-0 text-[13px] font-medium uppercase tracking-[0.16em] text-slate-400">
                    {[exp.start, exp.end].filter(Boolean).join(' — ')}
                  </div>
                </div>

                {exp.bullets.some((bullet) => bullet.trim().length > 0) ? (
                  <div className="mt-4 space-y-2.5 text-[14px] leading-6 text-slate-700">
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
          <ResumeFooterText title="Signature / Note" value={resume.footer} accent={accent} />
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

export const buildPremiumGoldenPages = (
  resume: ResumeData,
  isPdf = false
): ResumePage[] => {
  const accent = resume.editorSettings.accentColor || GOLD;
  const heroSections = [createHeroSection(resume)];
  const sidebarSections = createSidebarSections(resume, accent, isPdf);
  const mainSections = createMainSections(resume, accent);

  return paginateSections(heroSections, sidebarSections, mainSections);
};

export const ResumePremiumGolden = ({
  resume,
  isPdf = false,
  pageIndex
}: Props) => {
  const pages = buildPremiumGoldenPages(resume, isPdf);
  const visiblePages =
    typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

  return (
    <>
      {visiblePages.map((page, index) => (
        <div
          key={`resume-premium-golden-page-${index}`}
          data-pdf-page="true"
          className={`${resumePaperClassName} rounded-none bg-[#f7f3ea]`}
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
              gridTemplateColumns: '290px 1fr',
              minHeight: page.heroSections.length > 0 ? `${PAGE_HEIGHT - HERO_HEIGHT}px` : `${PAGE_HEIGHT}px`
            }}
          >
            <aside className="bg-[#17191d] px-8 pb-10 pt-10 text-white">
              <div
                className="mb-8 h-px w-full"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(201,162,79,0) 0%, rgba(201,162,79,0.6) 50%, rgba(201,162,79,0) 100%)'
                }}
              />
              {page.sidebarSections.map((section) => (
                <div key={section.key}>{section.content}</div>
              ))}
            </aside>

            <main className="bg-[#f7f3ea] px-10 pb-10 pt-10">
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