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

const CARD_BLUE = '#3c4f8f';
const CARD_BLUE_DARK = '#2d3d70';
const LEFT_BG = '#eef3ff';
const RIGHT_BG = '#f8fbff';
const TEXT_DARK = '#1f2937';
const TEXT_MUTED = '#627086';

const PAGE_PADDING_Y = 36;
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

const getVisibleAchievements = (resume: ResumeData) =>
  resume.achievements.filter(
    (item) =>
      (item.title ?? '').trim().length > 0 ||
      (item.description ?? '').trim().length > 0
  );

const CardTitle = ({ children }: { children: ReactNode }) => (
  <div className="mb-5">
    <div className="inline-flex rounded-full bg-[#3c4f8f] px-5 py-2 text-[12px] font-bold uppercase tracking-[0.18em] text-white">
      {children}
    </div>
  </div>
);

const LeftProfileSection = ({ resume }: { resume: ResumeData }) => (
  <section className="px-6">
    <div className="rounded-[34px] bg-[#3c4f8f] px-6 pb-6 pt-7 text-white shadow-[0_16px_34px_rgba(45,61,112,0.16)]">
      <div className="flex justify-center">
        <div className="rounded-full border-[6px] border-white p-[4px]">
          <ResumePhotoBlock
            photo={resume.personal.photo}
            alt={resume.personal.fullName}
            rounded="rounded-full"
            sizeClassName="h-[145px] w-[145px]"
          />
        </div>
      </div>

      <div className="mt-5 text-center">
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/70">
          Profile
        </div>
      </div>
    </div>
  </section>
);

const LeftContactSection = ({ resume }: { resume: ResumeData }) => {
  const rows = getVisibleContactRows(resume);
  if (!rows.length) return null;

  return (
    <section className="px-6">
      <CardTitle>Contact</CardTitle>

      <div className="space-y-4">
        {rows.map(([label, value], index) => (
          <div key={`${label}-${index}`} className="rounded-[22px] bg-white px-4 py-4 shadow-[0_8px_20px_rgba(60,79,143,0.06)]">
            <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#3c4f8f]">
              {label}
            </div>
            <div className="mt-1 break-words text-[14px] leading-6 text-[#4d596a]">
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
    <section className="px-6">
      <CardTitle>Education</CardTitle>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-[22px] bg-white px-4 py-4 shadow-[0_8px_20px_rgba(60,79,143,0.06)]">
            <div className="text-[16px] font-bold text-[#1f2937]">{item.degree}</div>
            <div className="mt-1 text-[14px] text-[#4d596a]">{item.school}</div>
            <div className="mt-1 text-[12px] uppercase tracking-[0.08em] text-[#7c8798]">
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
    <section className="px-6">
      <CardTitle>Skills</CardTitle>

      <div className="flex flex-wrap gap-3">
        {items.map((skill) => (
          <div
            key={skill.id}
            className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#2d3d70] shadow-[0_8px_18px_rgba(60,79,143,0.06)]"
          >
            {skill.name}
          </div>
        ))}
      </div>
    </section>
  );
};

const LeftLanguagesSection = ({ resume }: { resume: ResumeData }) => {
  const items = getVisibleLanguages(resume);
  if (!items.length) return null;

  return (
    <section className="px-6">
      <CardTitle>Languages</CardTitle>

      <div className="space-y-4">
        {items.map((lang) => (
          <div key={lang.id} className="rounded-[22px] bg-white px-4 py-4 shadow-[0_8px_20px_rgba(60,79,143,0.06)]">
            <div className="text-[15px] font-bold text-[#1f2937]">{lang.name}</div>
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
  <section className="px-10 pb-2 pt-10">
    <div className="rounded-[34px] bg-[#3c4f8f] px-8 py-8 text-white shadow-[0_16px_34px_rgba(45,61,112,0.16)]">
      <h1 className="text-[38px] font-extrabold leading-[0.96] tracking-[0.03em] text-white">
        {resume.personal.fullName}
      </h1>

      <div className="mt-3 text-[19px] font-medium text-white/88">
        {resume.personal.title}
      </div>

      {resume.professionalSummary?.trim() ? (
        <div className="mt-5 text-[14px] leading-7 text-white/90">
          {resume.professionalSummary}
        </div>
      ) : null}
    </div>
  </section>
);

const RightExperienceSection = ({ resume }: { resume: ResumeData }) => {
  const items = getVisibleExperience(resume);
  if (!items.length) return null;

  return (
    <section className="px-10 pb-2 pt-4">
      <h2 className="text-[24px] font-bold uppercase tracking-[0.05em] text-[#2d3d70]">
        Experience
      </h2>

      <div className="mt-7 space-y-6">
        {items.map((item) => {
          const bullets = item.bullets.filter((bullet) => bullet.trim().length > 0);

          return (
            <article
              key={item.id}
              className="rounded-[28px] border border-[#dbe3f8] bg-white px-6 py-5 shadow-[0_10px_24px_rgba(60,79,143,0.06)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[18px] font-bold text-[#1f2937]">{item.role}</div>
                  <div className="mt-1 text-[14px] text-[#5f6b7a]">
                    {[item.company, item.location, item.project].filter(Boolean).join(' • ')}
                  </div>
                </div>

                <div className="rounded-full bg-[#eef2ff] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#3c4f8f]">
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

const RightAchievementsSection = ({ resume }: { resume: ResumeData }) => {
  const items = getVisibleAchievements(resume);
  if (!items.length) return null;

  return (
    <section className="px-10 pb-10 pt-4">
      <h2 className="text-[24px] font-bold uppercase tracking-[0.05em] text-[#2d3d70]">
        Achievements
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-6">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-[24px] border border-[#dbe3f8] bg-white px-5 py-4 shadow-[0_10px_24px_rgba(60,79,143,0.05)]"
          >
            <div className="text-[16px] font-bold text-[#1f2937]">{item.title}</div>
            {item.description ? (
              <div className="mt-2 text-[14px] leading-6 text-[#4d596a]">
                {item.description}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
};

const createLeftSections = (resume: ResumeData): PageSection[] => {
  const sections: PageSection[] = [
    {
      key: 'profile',
      estimatedHeight: 240,
      content: <LeftProfileSection resume={resume} />
    }
  ];

  if (getVisibleContactRows(resume).length > 0) {
    sections.push({
      key: 'contact',
      estimatedHeight: 210,
      content: <LeftContactSection resume={resume} />
    });
  }

  if (getVisibleEducation(resume).length > 0) {
    sections.push({
      key: 'education',
      estimatedHeight: 180,
      content: <LeftEducationSection resume={resume} />
    });
  }

  if (getVisibleSkills(resume).length > 0) {
    sections.push({
      key: 'skills',
      estimatedHeight: 170,
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
      estimatedHeight: 220,
      content: <RightHeaderSection resume={resume} />
    }
  ];

  if (getVisibleExperience(resume).length > 0) {
    sections.push({
      key: 'experience',
      estimatedHeight: 470,
      content: <RightExperienceSection resume={resume} />
    });
  }

  if (getVisibleAchievements(resume).length > 0) {
    sections.push({
      key: 'achievements',
      estimatedHeight: 220,
      content: <RightAchievementsSection resume={resume} />
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

export const buildRoundedCardProfilePages = (resume: ResumeData): ResumePage[] => {
  const leftSections = createLeftSections(resume);
  const rightSections = createRightSections(resume);
  return paginateSections(leftSections, rightSections);
};

export const ResumeRoundedCardProfile = ({
  resume,
  pageIndex
}: Props) => {
  const pages = buildRoundedCardProfilePages(resume);
  const visiblePages =
    typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

  return (
    <>
      {visiblePages.map((page, index) => (
        <div
          key={`resume-rounded-card-profile-${index}`}
          data-pdf-page="true"
          className={`${resumePaperClassName} rounded-none bg-[#f8fbff]`}
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
              gridTemplateColumns: '36% 64%'
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