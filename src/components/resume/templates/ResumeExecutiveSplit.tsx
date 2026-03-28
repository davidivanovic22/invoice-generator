import { ResumeData } from "../../../types/resume";
import { ResumeContactListBlock } from "../blocks/ResumeContactListBlock";
import { ResumeLanguageListBlock } from "../blocks/ResumeLanguageListBlock";
import { ResumePhotoBlock } from "../blocks/ResumePhotoBlock";
import { ResumeSectionTitleBlock } from "../blocks/ResumeSectionTitleBlock";
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
} from "./ResumeBlocks";
import { resumePaperClassName, resumePaperStyle } from "./shared";

type Props = {
  resume: ResumeData;
  isPdf?: boolean;
};

export const ResumeExecutiveSplit = ({ resume, isPdf = false }: Props) => {
  const accent = resume.editorSettings.accentColor;

  return (
    <div
      className={`${resumePaperClassName} rounded-none`}
      style={{
        ...resumePaperStyle,
        fontSize: `${resume.editorSettings.baseFontSize}px`
      }}
    >
      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: "290px 1fr",
          minHeight: resumePaperStyle.minHeight
        }}
      >
        <aside
          className="p-7 text-white"
          style={{ background: accent, minHeight: resumePaperStyle.minHeight }}
        >
          <div className="flex flex-col items-center border-b border-white/20 pb-6">
            <ResumePhotoBlock
              photo={resume.personal.photo}
              alt={resume.personal.fullName}
              light
              sizeClassName="h-32 w-32"
              rounded="rounded-2xl"
            />

            <h1 className="mt-5 w-full text-left text-[20px] font-bold leading-tight">
              {resume.personal.fullName}
            </h1>
            <p className="mt-1 w-full text-left text-sm text-white/80">
              {resume.personal.title}
            </p>
          </div>

          <section className="mt-6">
            <ResumeSectionTitleBlock accent={accent} light>
              Contact
            </ResumeSectionTitleBlock>
            <ResumeContactListBlock  resume={resume} light ></ResumeContactListBlock>
          </section>

          <section className="mt-7">
            <ResumeSectionTitleBlock accent={accent} light>
              Skills
            </ResumeSectionTitleBlock>
            <ResumeSkillGrid
              skills={resume.skills}
              accent={accent}
              light
              isPdf={isPdf}
            />
          </section>

          {resume.enabledSections.qualities && resume.qualities.length > 0 && (
            <section className="mt-7">
              <ResumeDotPercentageRatings
                items={resume.qualities}
                accent={accent}
                light
              />
            </section>
          )}

          {resume.enabledSections.references && resume.references.length > 0 && (
            <section className="mt-7">
              <ResumeReferencesList resume={resume} accent={accent} light />
            </section>
          )}

          <section className="mt-7">
            <ResumeSectionTitleBlock accent={accent} light>
              Languages
            </ResumeSectionTitleBlock>
            <ResumeLanguageListBlock resume={resume} light ></ResumeLanguageListBlock>
          </section>

          {resume.enabledSections.signature && resume.signature && (
            <section className="mt-7">
              <ResumeFooterText
                title="Signature"
                value={resume.signature}
                accent={accent}
                light
              />
            </section>
          )}
        </aside>

        <main className="p-7 text-slate-800">
          <ResumeSummary resume={resume} accent={accent} />

          <div className="mt-8">
            <ResumeExperienceList
              resume={resume}
              accent={accent}
              isPdf={isPdf}
            />
          </div>

          {resume.enabledSections.internships && resume.internships.length > 0 && (
            <div className="mt-8">
              <ResumeInternshipsList resume={resume} accent={accent} />
            </div>
          )}

          <section className="mt-8 grid grid-cols-[1fr_1fr] items-start gap-10">
            <div>
              <ResumeEducationList resume={resume} accent={accent} />

              {resume.enabledSections.courses && resume.courses.length > 0 && (
                <div className="mt-8">
                  <ResumeCoursesList resume={resume} accent={accent} />
                </div>
              )}
            </div>

            <div>
              {resume.enabledSections.certificates && resume.certificates.length > 0 && (
                <div>
                  <ResumeCertificatesList resume={resume} accent={accent} />
                </div>
              )}

              {resume.enabledSections.achievements && resume.achievements.length > 0 && (
                <div className="mt-8">
                  <ResumeAchievementsList resume={resume} accent={accent} />
                </div>
              )}

              {resume.enabledSections.extracurricularActivities &&
                resume.extracurricularActivities.length > 0 && (
                  <div className="mt-8">
                    <ResumeStringSection
                      title="Extracurricular Activities"
                      items={resume.extracurricularActivities}
                      accent={accent}
                    />
                  </div>
                )}
            </div>
          </section>

          {resume.enabledSections.footer && resume.footer && (
            <div className="mt-8">
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