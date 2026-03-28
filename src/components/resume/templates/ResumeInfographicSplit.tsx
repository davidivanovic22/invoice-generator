import { ResumeData } from '../../../types/resume';
import { ResumeLanguageListBlock } from '../blocks/ResumeLanguageListBlock';
import { ResumePhotoBlock } from '../blocks/ResumePhotoBlock';
import { ResumeSectionTitleBlock } from '../blocks/ResumeSectionTitleBlock';
import {
    ResumeAchievementsList,
    ResumeCompactReferences,
    ResumeDotPercentageRatings,
    ResumeExperienceList,
    ResumeProfessionalSkillsBubbles,
    ResumeSummary
} from './ResumeBlocks';
import { resumePaperClassName, resumePaperStyle } from './shared';

type Props = {
  resume: ResumeData;
  isPdf?: boolean;
};

export const ResumeInfographicSplit = ({ resume, isPdf = false }: Props) => {
  const accent = resume.editorSettings.accentColor || '#ef4444';
  const dark = '#17324d';

  const topSkills = [...resume.skills]
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 8);

  const topQualities = resume.qualities;

  return (
    <div
      className={`${resumePaperClassName} rounded-none bg-[#f8fafc]`}
      style={{
        ...resumePaperStyle,
        fontSize: `${resume.editorSettings.baseFontSize}px`
      }}
    >
      <header className="bg-[#6b7280] px-10 pb-5 pt-8 text-white">
        <div className="grid grid-cols-[110px_1fr] items-center gap-6">
          <div className="rounded-full border-[6px] border-white/80 p-1">
            <ResumePhotoBlock
              photo={resume.personal.photo}
              alt={resume.personal.fullName}
              rounded="rounded-full"
              sizeClassName="h-24 w-24"
              light
            />
          </div>

          <div>
            <h1 className="text-[30px] font-extrabold uppercase tracking-wide">
              {resume.personal.fullName}
            </h1>

            <div className="mt-1 text-[16px] text-white/85">
              {resume.personal.title}
            </div>

            <div className="mt-3 text-[12px] text-white/80">
              {[
                resume.personal.email,
                resume.personal.phone,
                resume.personal.website
              ]
                .filter(Boolean)
                .join('  •  ')}
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white px-10 py-5">
        <ResumeSummary resume={resume} accent={accent} />
      </div>

      <div className="grid grid-cols-[0.95fr_1.05fr] gap-0">
        <aside className="bg-[#f3f4f6] px-8 py-8">
          <ResumeEducationListBlock resume={resume} accent={accent} />

          {topSkills.length > 0 && (
            <div className="mt-8">
              <ResumeSectionTitleBlock accent={accent}>Professional Skills</ResumeSectionTitleBlock>

              <ResumeProfessionalSkillsBubbles
                skills={topSkills}
                accent={accent}
                isPdf={isPdf}
              />

              <div className="mt-4">
                <ResumeDotPercentageRatings
                  items={topSkills}
                  accent={accent}
                  darkAccent={dark}
                />
              </div>
            </div>
          )}

          <div className="mt-8">
            <ResumeSectionTitleBlock accent={accent}>Languages</ResumeSectionTitleBlock>
            <ResumeLanguageListBlock resume={resume} ></ResumeLanguageListBlock>
          </div>

          {resume.enabledSections.achievements && resume.achievements.length > 0 && (
            <div className="mt-8">
              <ResumeAchievementsList resume={resume} accent={accent} />
            </div>
          )}
        </aside>

        <main className="bg-white px-8 py-8">
          <div className="space-y-6">
               <ResumeExperienceList
                       resume={resume}
                       accent={accent}
                       isPdf={isPdf}
                     />
          </div>

          {resume.enabledSections.qualities && topQualities.length > 0 && (
            <div className="mt-8">
              <ResumeSectionTitleBlock accent={accent}>Personal Qualities</ResumeSectionTitleBlock>

              <ResumeDotPercentageRatings
                items={topQualities}
                accent={accent}
                darkAccent={dark}
              />
            </div>
          )}

          {resume.enabledSections.references && resume.references.length > 0 && (
            <div className="mt-8">
              <ResumeCompactReferences resume={resume} accent={accent} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const ResumeEducationListBlock = ({
  resume,
  accent
}: {
  resume: ResumeData;
  accent: string;
}) => {
  if (!resume.education.length) return null;

  return (
    <section>
      <ResumeSectionTitleBlock accent={accent}>Education</ResumeSectionTitleBlock>

      <div className="space-y-5">
        {resume.education.map((edu) => (
          <article key={edu.id}>
            <div className="text-[13px] font-semibold" style={{ color: accent }}>
              {edu.start} - {edu.end}
            </div>

            <div className="mt-1 text-[15px] font-bold text-slate-900">
              {edu.school}
            </div>

            <div className="text-[13px] text-slate-600">{edu.degree}</div>
          </article>
        ))}
      </div>
    </section>
  );
};