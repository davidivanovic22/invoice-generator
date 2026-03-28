import { ResumeData } from "../../../types/resume";
import { resumePaperClassName, resumePaperStyle } from "./shared";
import {
  ResumeAchievementsList,
  ResumeCertificatesList,
  ResumeContactList,
  ResumeCoursesList,
  ResumeEducationList,
  ResumeExperienceList,
  ResumeFooterText,
  ResumeInternshipsList,
  ResumeLanguageList,
  ResumePhoto,
  ResumeReferencesList,
  ResumeSectionTitle,
  ResumeSkillGrid,
  ResumeStringSection,
  ResumeSummary
} from "./ResumeBlocks";

type Props = {
  resume: ResumeData;
  isPdf?: boolean;
};

export const ResumeDarkPro = ({ resume, isPdf = false }: Props) => {
  const accent = resume.editorSettings.accentColor;

  return (
    <div
      className={`${resumePaperClassName} rounded-none overflow-hidden`}
      style={{
        ...resumePaperStyle,
        background: "#0f172a",
        color: "#ffffff",
        fontSize: `${resume.editorSettings.baseFontSize}px`
      }}
    >
      <div className="grid h-full grid-cols-[260px_1fr]">
        <aside
          className="h-full p-8"
          style={{
            background: accent,
            minHeight: resumePaperStyle.minHeight
          }}
        >
          <div className="flex flex-col items-center border-b border-white/20 pb-6">
            <ResumePhoto
              photo={resume.personal.photo}
              alt={resume.personal.fullName}
              light
              sizeClassName="h-28 w-28"
              rounded="rounded-2xl"
            />

            <h1 className="mt-5 w-full text-left text-[24px] font-bold leading-tight text-white">
              {resume.personal.fullName}
            </h1>

            <p className="mt-1 w-full text-left text-sm text-white/80">
              {resume.personal.title}
            </p>
          </div>

          <div className="mt-6">
            <ResumeSectionTitle accent={accent} light>
              Contact
            </ResumeSectionTitle>
            <ResumeContactList resume={resume} light />
          </div>

          <div className="mt-6">
            <ResumeSectionTitle accent={accent} light>
              Skills
            </ResumeSectionTitle>
            <ResumeSkillGrid
              skills={resume.skills}
              accent={accent}
              light
              isPdf={isPdf}
            />
          </div>

          {resume.enabledSections.qualities && resume.qualities.length > 0 && (
            <div className="mt-6">
              <ResumeStringSection
                title="Qualities"
                items={resume.qualities}
                accent={accent}
                light
              />
            </div>
          )}

          <div className="mt-6">
            <ResumeSectionTitle accent={accent} light>
              Languages
            </ResumeSectionTitle>
            <ResumeLanguageList resume={resume} light />
          </div>

          {resume.enabledSections.signature && resume.signature && (
            <div className="mt-6">
              <ResumeFooterText
                title="Signature"
                value={resume.signature}
                accent={accent}
                light
              />
            </div>
          )}
        </aside>

        <main className="p-8 text-white">
          <ResumeSummary resume={resume} accent={accent} light />

          <div className="mt-8">
            <ResumeExperienceList
              resume={resume}
              accent={accent}
              light
              isPdf={isPdf}
            />
          </div>

          {resume.enabledSections.internships && resume.internships.length > 0 && (
            <div className="mt-8">
              <ResumeInternshipsList resume={resume} accent={accent} light />
            </div>
          )}

          <div className="mt-8 grid grid-cols-2 gap-8">
            <div>
              <ResumeEducationList resume={resume} accent={accent} light />

              {resume.enabledSections.courses && resume.courses.length > 0 && (
                <div className="mt-8">
                  <ResumeCoursesList resume={resume} accent={accent} light />
                </div>
              )}

              {resume.enabledSections.references && resume.references.length > 0 && (
                <div className="mt-8">
                  <ResumeReferencesList resume={resume} accent={accent} light />
                </div>
              )}
            </div>

            <div>
              {resume.enabledSections.certificates && resume.certificates.length > 0 && (
                <div>
                  <ResumeCertificatesList resume={resume} accent={accent} light />
                </div>
              )}

              {resume.enabledSections.achievements && resume.achievements.length > 0 && (
                <div className="mt-8">
                  <ResumeAchievementsList resume={resume} accent={accent} light />
                </div>
              )}

              {resume.enabledSections.extracurricularActivities &&
                resume.extracurricularActivities.length > 0 && (
                  <div className="mt-8">
                    <ResumeStringSection
                      title="Extracurricular Activities"
                      items={resume.extracurricularActivities}
                      accent={accent}
                      light
                    />
                  </div>
                )}
            </div>
          </div>

          {resume.enabledSections.footer && resume.footer && (
            <div className="mt-8">
              <ResumeFooterText
                title="Footer"
                value={resume.footer}
                accent={accent}
                light
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};