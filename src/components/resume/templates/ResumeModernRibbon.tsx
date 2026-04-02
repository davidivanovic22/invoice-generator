import type { ReactNode } from 'react';
import { ResumeData } from '../../../types/resume';
import { ResumePhotoBlock } from '../blocks/ResumePhotoBlock';
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

const RIBBON_RED = '#b71f3b';
const RIBBON_RED_DARK = '#8d1730';
const RIBBON_NAVY = '#1c304a';
const LEFT_BG = '#f3f6fb';
const RIGHT_BG = '#ffffff';
const TEXT_DARK = '#1f2937';
const TEXT_MUTED = '#5f6b7a';

const PAGE_PADDING_Y = 36;
const PAGE_HEIGHT = 1123;
const USABLE_HEIGHT = 980;

const getVisibleContactRows = (resume: ResumeData) =>
  [
    ['Phone', resume.personal.phone],
    ['Email', resume.personal.email],
    ['Address', resume.personal.address],
    ['LinkedIn', resume.enabledPersonalFields.linkedin ? resume.personal.linkedin : undefined],
    ['GitHub', resume.enabledPersonalFields.github ? resume.personal.github : undefined],
    ['Website', resume.enabledPersonalFields.website ? resume.personal.website : undefined]
  ].filter((row): row is [string, string] => typeof row[1] === 'string' && row[1].trim().length > 0);

const getVisibleEducation = (resume: ResumeData) =>
  resume.education.filter(
    (item) =>
      (item.school ?? '').trim().length > 0 ||
      (item.degree ?? '').trim().length > 0 ||
      (item.start ?? '').trim().length > 0 ||
      (item.end ?? '').trim().length > 0
  );

const getVisibleExperience = (resume: ResumeData) =>
  resume.experience.filter(
    (item) =>
      (item.role ?? '').trim().length > 0 ||
      (item.company ?? '').trim().length > 0 ||
      (item.location ?? '').trim().length > 0 ||
      (item.project ?? '').trim().length > 0 ||
      item.bullets.some((bullet) => bullet.trim().length > 0)
  );

const getVisibleSkills = (resume: ResumeData) =>
  resume.skills
    .filter((skill) => (skill.name ?? '').trim().length > 0)
    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));

const getVisibleLanguages = (resume: ResumeData) =>
  resume.languages.filter((lang) => (lang.name ?? '').trim().length > 0);

const getVisibleReferences = (resume: ResumeData) =>
  resume.references.filter(
    (ref) =>
      (ref.name ?? '').trim().length > 0 ||
      (ref.company ?? '').trim().length > 0 ||
      (ref.phone ?? '').trim().length > 0 ||
      (ref.email ?? '').trim().length > 0
  );

const RibbonTitle = ({ children }: { children: ReactNode }) => (
  <div className="relative mb-6">
    <div className="bg-[#1c304a] px-6 py-3 text-[18px] font-bold uppercase tracking-[0.08em] text-white">
      {children}
    </div>
    <div
      className="absolute right-0 top-full h-0 w-0"
      style={{
        borderTop: '16px solid #142334',
        borderLeft: '16px solid transparent'
      }}
    />
  </div>
);

const LeftProfileSection = ({ resume }: { resume: ResumeData }) => (
  <section className="px-6">
    <div className="relative overflow-hidden rounded-[28px] bg-[#1c304a] px-6 pb-7 pt-6 text-white">
      <div className="absolute inset-y-0 left-0 w-[18px] bg-[#b71f3b]" />
      <div className="pl-4">
        <div className="mb-5 flex justify-center">
          <div className="rounded-full border-[5px] border-white p-[4px] shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
            <ResumePhotoBlock
              photo={resume.personal.photo}
              alt={resume.personal.fullName}
              rounded="rounded-full"
              sizeClassName="h-[135px] w-[135px]"
            />
          </div>
        </div>

        <div className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-white/70">
          Resume Profile
        </div>
      </div>
    </div>
  </section>
);

const LeftContactSection = ({ resume }: { resume: ResumeData }) => {
  const rows = getVisibleContactRows(resume);
  if (!rows.length) return null;

  return (
    <section>
      <RibbonTitle>Contact</RibbonTitle>

      <div className="space-y-5 px-6">
        {rows.map(([label, value], index) => (
          <div key={`${label}-${index}`}>
            <div className="text-[15px] font-bold uppercase tracking-[0.08em] text-[#1c304a]">
              {label}
            </div>
            <div className="mt-1 break-words text-[14px] leading-6 text-[#4c5663]">
              {value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const LeftEducationSection = ({ resume }: { resume: ResumeData }) => {
  const items = getVisibleEducation(resume);
  if (!items.length) return null;

  return (
    <section>
      <RibbonTitle>Education</RibbonTitle>

      <div className="space-y-6 px-6">
        {items.map((item) => (
          <div key={item.id}>
            <div className="text-[16px] font-bold text-[#1f2937]">{item.degree}</div>
            <div className="mt-1 text-[14px] font-medium text-[#4b5563]">{item.school}</div>
            <div className="mt-1 text-[13px] uppercase tracking-[0.08em] text-[#7b8794]">
              {[item.start, item.end].filter(Boolean).join(' - ')}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const LeftSkillsSection = ({ resume }: { resume: ResumeData }) => {
  const items = getVisibleSkills(resume);
  if (!items.length) return null;

  return (
    <section>
      <RibbonTitle>Skills</RibbonTitle>

      <div className="space-y-4 px-6">
        {items.map((skill) => {
          const percent = Math.max(0, Math.min(skill.percent ?? 0, 100));

          return (
            <div key={skill.id}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-[14px] font-semibold text-[#1f2937]">{skill.name}</span>
                <span className="text-[12px] font-bold text-[#b71f3b]">{percent}%</span>
              </div>
              <div className="h-[7px] rounded-full bg-[#d7dfeb]">
                <div
                  className="h-[7px] rounded-full"
                  style={{
                    width: `${percent}%`,
                    background: `linear-gradient(90deg, ${RIBBON_NAVY} 0%, ${RIBBON_RED} 100%)`
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const LeftLanguagesSection = ({ resume }: { resume: ResumeData }) => {
  const items = getVisibleLanguages(resume);
  if (!items.length) return null;

  return (
    <section>
      <RibbonTitle>Languages</RibbonTitle>

      <div className="space-y-3 px-6">
        {items.map((lang) => (
          <div key={lang.id} className="rounded-2xl bg-white px-4 py-3 shadow-[0_6px_16px_rgba(28,48,74,0.05)]">
            <div className="text-[14px] font-bold text-[#1f2937]">{lang.name}</div>
            {lang.level ? (
              <div className="mt-1 text-[13px] text-[#6b7280]">{lang.level}</div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
};

const RightHeaderSection = ({ resume }: { resume: ResumeData }) => (
  <section className="relative overflow-hidden px-10 pb-4 pt-10">
    <div className="absolute left-0 top-0 h-full w-[18px] bg-[#1c304a]" />
    <div className="absolute left-[18px] top-0 h-full w-[42px] bg-[#b71f3b]" />
    <div className="relative pl-16">
      <h1 className="text-[42px] font-extrabold uppercase leading-[0.95] tracking-[0.04em] text-[#1f2937]">
        {resume.personal.fullName}
      </h1>

      <div className="mt-4 text-[20px] font-medium uppercase tracking-[0.12em] text-[#5f6b7a]">
        {resume.personal.title}
      </div>
    </div>
  </section>
);

const RightSummarySection = ({ resume }: { resume: ResumeData }) => {
  if (!resume.professionalSummary?.trim()) return null;

  return (
    <section className="px-10 pb-2 pt-4">
      <h2 className="text-[24px] font-bold uppercase tracking-[0.05em] text-[#1c304a]">
        Professional Summary
      </h2>
      <div className="mt-4 rounded-[24px] border border-[#e4e9f2] bg-[#fafbfd] px-6 py-5 text-[14px] leading-7 text-[#4b5563]">
        {resume.professionalSummary}
      </div>
    </section>
  );
};

const RightExperienceSection = ({ resume }: { resume: ResumeData }) => {
  const items = getVisibleExperience(resume);
  if (!items.length) return null;

  return (
    <section className="px-10 pb-2 pt-4">
      <h2 className="text-[24px] font-bold uppercase tracking-[0.05em] text-[#1c304a]">
        Professional Experience
      </h2>

      <div className="mt-8 space-y-6">
        {items.map((item) => {
          const bullets = item.bullets.filter((bullet) => bullet.trim().length > 0);

          return (
            <article
              key={item.id}
              className="rounded-[26px] border border-[#e5eaf3] bg-white px-6 py-5 shadow-[0_10px_20px_rgba(28,48,74,0.05)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[18px] font-bold text-[#1f2937]">{item.role}</div>
                  <div className="mt-1 text-[14px] text-[#5f6b7a]">
                    {[item.company, item.location, item.project].filter(Boolean).join(' • ')}
                  </div>
                </div>

                <div className="rounded-full bg-[#eef2f8] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#b71f3b]">
                  {[item.start, item.end].filter(Boolean).join(' - ')}
                </div>
              </div>

              {bullets.length > 0 ? (
                <ul className="mt-4 space-y-2 pl-5 text-[14px] leading-7 text-[#46515e]">
                  {bullets.map((bullet, index) => (
                    <li key={`${item.id}-bullet-${index}`}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
};

const RightReferencesSection = ({ resume }: { resume: ResumeData }) => {
  const items = getVisibleReferences(resume);
  if (!items.length) return null;

  return (
    <section className="px-10 pb-10 pt-4">
      <h2 className="text-[24px] font-bold uppercase tracking-[0.05em] text-[#1c304a]">
        References
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-6">
        {items.slice(0, 4).map((item) => (
          <div
            key={item.id}
            className="rounded-[22px] border border-[#e5eaf3] bg-[#fbfcfe] px-5 py-4"
          >
            <div className="text-[16px] font-bold text-[#1f2937]">{item.name}</div>
            {item.company ? (
              <div className="mt-1 text-[14px] text-[#5f6b7a]">{item.company}</div>
            ) : null}

            <div className="mt-3 space-y-1 text-[13px] leading-6 text-[#4b5563]">
              {item.phone ? <div>{item.phone}</div> : null}
              {item.email ? <div>{item.email}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const createLeftSections = (resume: ResumeData): PageSection[] => {
  const sections: PageSection[] = [
    {
      key: 'profile',
      estimatedHeight: 230,
      content: <LeftProfileSection resume={resume} />
    }
  ];

  if (getVisibleContactRows(resume).length > 0) {
    sections.push({
      key: 'contact',
      estimatedHeight: 180,
      content: <LeftContactSection resume={resume} />
    });
  }

  if (getVisibleEducation(resume).length > 0) {
    sections.push({
      key: 'education',
      estimatedHeight: 160,
      content: <LeftEducationSection resume={resume} />
    });
  }

  if (getVisibleSkills(resume).length > 0) {
    sections.push({
      key: 'skills',
      estimatedHeight: 210,
      content: <LeftSkillsSection resume={resume} />
    });
  }

  if (getVisibleLanguages(resume).length > 0) {
    sections.push({
      key: 'languages',
      estimatedHeight: 150,
      content: <LeftLanguagesSection resume={resume} />
    });
  }

  return sections;
};

const createRightSections = (resume: ResumeData): PageSection[] => {
  const sections: PageSection[] = [
    {
      key: 'header',
      estimatedHeight: 150,
      content: <RightHeaderSection resume={resume} />
    }
  ];

  if (resume.professionalSummary?.trim()) {
    sections.push({
      key: 'summary',
      estimatedHeight: 150,
      content: <RightSummarySection resume={resume} />
    });
  }

  if (getVisibleExperience(resume).length > 0) {
    sections.push({
      key: 'experience',
      estimatedHeight: 470,
      content: <RightExperienceSection resume={resume} />
    });
  }

  if (getVisibleReferences(resume).length > 0) {
    sections.push({
      key: 'references',
      estimatedHeight: 180,
      content: <RightReferencesSection resume={resume} />
    });
  }

  return sections;
};

const paginateSections = (
  leftSections: PageSection[],
  rightSections: PageSection[]
): ResumePage[] => {
  const pages: ResumePage[] = [];

  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftSections.length || rightIndex < rightSections.length) {
    let leftUsed = 0;
    let rightUsed = 0;

    const currentLeft: PageSection[] = [];
    const currentRight: PageSection[] = [];

    while (leftIndex < leftSections.length) {
      const next = leftSections[leftIndex];
      if (currentLeft.length > 0 && leftUsed + next.estimatedHeight > USABLE_HEIGHT) break;
      currentLeft.push(next);
      leftUsed += next.estimatedHeight;
      leftIndex += 1;
    }

    while (rightIndex < rightSections.length) {
      const next = rightSections[rightIndex];
      if (currentRight.length > 0 && rightUsed + next.estimatedHeight > USABLE_HEIGHT) break;
      currentRight.push(next);
      rightUsed += next.estimatedHeight;
      rightIndex += 1;
    }

    if (currentLeft.length === 0 && leftIndex < leftSections.length) {
      currentLeft.push(leftSections[leftIndex]);
      leftIndex += 1;
    }

    if (currentRight.length === 0 && rightIndex < rightSections.length) {
      currentRight.push(rightSections[rightIndex]);
      rightIndex += 1;
    }

    pages.push({
      leftSections: currentLeft,
      rightSections: currentRight
    });
  }

  return pages;
};

export const buildModernRibbonPages = (resume: ResumeData): ResumePage[] => {
  const leftSections = createLeftSections(resume);
  const rightSections = createRightSections(resume);
  return paginateSections(leftSections, rightSections);
};

export const ResumeModernRibbon = ({
  resume,
  pageIndex
}: Props) => {
  const pages = buildModernRibbonPages(resume);
  const visiblePages =
    typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

  return (
    <>
      {visiblePages.map((page, index) => (
        <div
          key={`resume-modern-ribbon-${index}`}
          data-pdf-page="true"
          className={`${resumePaperClassName} rounded-none bg-[#ffffff]`}
          style={{
            ...resumePaperStyle,
            width: '794px',
            fontSize: `${resume.editorSettings.baseFontSize}px`,
            breakAfter: index === visiblePages.length - 1 ? 'auto' : 'page',
            pageBreakAfter: index === visiblePages.length - 1 ? 'auto' : 'always'
          }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: '35% 65%'
            }}
          >
            <aside
              className="min-h-full"
              style={{
                background: LEFT_BG,
                paddingTop: `${PAGE_PADDING_Y}px`,
                paddingBottom: `${PAGE_PADDING_Y}px`
              }}
            >
              <div className="space-y-10">
                {page.leftSections.map((section) => (
                  <div key={section.key}>{section.content}</div>
                ))}
              </div>
            </aside>

            <main
              className="min-h-full"
              style={{
                background: RIGHT_BG,
                paddingTop: `${PAGE_PADDING_Y}px`,
                paddingBottom: `${PAGE_PADDING_Y}px`
              }}
            >
              <div className="space-y-4">
                {page.rightSections.map((section) => (
                  <div key={section.key}>{section.content}</div>
                ))}
              </div>
            </main>
          </div>
        </div>
      ))}
    </>
  );
};