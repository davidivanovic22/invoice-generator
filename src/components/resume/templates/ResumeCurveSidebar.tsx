import { ResumeData } from '../../../types/resume';
import { ResumeContactListBlock } from '../blocks/ResumeContactListBlock';
import { ResumeLanguageListBlock } from '../blocks/ResumeLanguageListBlock';
import { ResumePhotoBlock } from '../blocks/ResumePhotoBlock';
import { ResumeSectionTitleBlock } from '../blocks/ResumeSectionTitleBlock';
import {
  ResumeDotPercentageRatings,
  ResumeEducationList,
  ResumeExperienceList,
  ResumeFooterText,
  ResumeReferencesList,
  ResumeSkillGrid,
  ResumeStringSection,
  ResumeSummary
} from './ResumeBlocks';
import { resumePaperClassName, resumePaperStyle } from './shared';

type Props = {
  resume: ResumeData;
  isPdf?: boolean;
};

const getVisibleSkills = (resume: ResumeData) =>
  resume.skills
    .filter((skill) => skill.name.trim().length > 0 && skill.percent > 0)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 6);

export const ResumeCurveSidebar = ({
  resume,
  isPdf = false
}: Props) => {
  const accent = resume.editorSettings.accentColor || '#7c3f2c';
  const visibleSkills = getVisibleSkills(resume);

  return (
    <div
      className={`${resumePaperClassName} relative overflow-hidden rounded-none bg-white text-slate-900`}
      style={{
        ...resumePaperStyle,
        fontSize: `${resume.editorSettings.baseFontSize}px`
      }}
    >
      <div className="grid min-h-[1123px] grid-cols-[290px_1fr]">
        <aside className="relative overflow-hidden bg-[#1b2b47] px-6 pb-10 pt-9 text-white">
          <div
            className="absolute inset-y-0 right-[-68px] w-[140px] rounded-l-[82px]"
            style={{ backgroundColor: accent }}
          />

          <div className="relative z-10">
            <div className="flex justify-center">
              <div className="rounded-full border-[5px] border-white/70 p-1">
                <ResumePhotoBlock
                  photo={resume.personal.photo}
                  alt={resume.personal.fullName}
                  rounded="rounded-full"
                  sizeClassName="h-24 w-24"
                  light
                />
              </div>
            </div>

            <div className="mt-9">
              <ResumeSectionTitleBlock accent="#ffffff" light>
                Contact
              </ResumeSectionTitleBlock>
              <ResumeContactListBlock resume={resume} light ></ResumeContactListBlock>
            </div>

            {visibleSkills.length > 0 && (
              <div className="mt-8">
                <ResumeSectionTitleBlock accent="#ffffff" light>
                  Skills
                </ResumeSectionTitleBlock>

                <ResumeSkillGrid
                  skills={visibleSkills}
                  accent="#ffffff"
                  light
                  isPdf={isPdf}
                  showPercent={false}
                />
              </div>
            )}

            {resume.languages.length > 0 && (
              <div className="mt-8">
                <ResumeSectionTitleBlock accent="#ffffff" light>
                  Languages
                </ResumeSectionTitleBlock>
                <ResumeLanguageListBlock resume={resume} light ></ResumeLanguageListBlock>
              </div>
            )}

            {resume.enabledSections.qualities && resume.qualities.length > 0 && (
              <div className="mt-8">
                <ResumeDotPercentageRatings
                  items={resume.qualities}
                  accent="#ffffff"
                />
              </div>
            )}
          </div>
        </aside>

        <main className="px-10 pb-10 pt-11">
          <header>
            <h1 className="text-[31px] font-extrabold uppercase tracking-[0.18em] text-slate-900">
              {resume.personal.fullName}
            </h1>

            <div
              className="mt-3 text-[16px] font-medium uppercase tracking-[0.22em]"
              style={{ color: accent }}
            >
              {resume.personal.title}
            </div>
          </header>

          <div className="mt-9">
            <ResumeSummary resume={resume} accent={accent} />
          </div>

          <div className="mt-9">
            <ResumeEducationList resume={resume} accent={accent} />
          </div>

          <div className="mt-9">
            <ResumeExperienceList
              resume={resume}
              accent={accent}
              compact={false}
              isPdf={isPdf}
            />
          </div>

          {resume.enabledSections.references && resume.references.length > 0 && (
            <div className="mt-9">
              <ResumeReferencesList resume={resume} accent={accent} />
            </div>
          )}

          {resume.enabledSections.extracurricularActivities &&
            resume.extracurricularActivities.length > 0 && (
              <div className="mt-9">
                <ResumeStringSection
                  title="Activities"
                  items={resume.extracurricularActivities}
                  accent={accent}
                />
              </div>
            )}

          {resume.enabledSections.footer && resume.footer && (
            <div className="mt-9">
              <ResumeFooterText
                title="Footer"
                value={resume.footer}
                accent={accent}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};