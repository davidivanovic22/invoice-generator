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

export const ResumeCompactPro = ({ resume, isPdf = false }: Props) => {
  const accent = resume.editorSettings.accentColor;

  return (
    <div
      className={`${resumePaperClassName} rounded-none`}
      style={{
        ...resumePaperStyle,
        fontSize: `${Math.max(12, resume.editorSettings.baseFontSize - 2)}px`
      }}
    >
      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: "220px 1fr",
          minHeight: resumePaperStyle.minHeight
        }}
      >
        <aside
          className="h-full border-r p-6"
          style={{
            borderColor: `${accent}22`,
            background: `${accent}0D`,
            minHeight: resumePaperStyle.minHeight
          }}
        >
          <div className="flex flex-col items-center">
            <ResumePhoto
              photo={resume.personal.photo}
              alt={resume.personal.fullName}
              sizeClassName="h-24 w-24"
              rounded="rounded-xl"
            />

            <h1 className="mt-4 w-full text-center text-[22px] font-bold leading-tight text-slate-900">
              {resume.personal.fullName}
            </h1>

            <p
              className="mt-1 w-full text-center text-[13px] font-medium"
              style={{ color: accent }}
            >
              {resume.personal.title}
            </p>
          </div>

          <div className="mt-6">
            <ResumeSectionTitle accent={accent}>Contact</ResumeSectionTitle>
            <ResumeContactList resume={resume} />
          </div>

          <div className="mt-6">
            <ResumeSectionTitle accent={accent}>Skills</ResumeSectionTitle>
            <ResumeSkillGrid
              skills={resume.skills}
              accent={accent}
              isPdf={isPdf}
            />
          </div>

          {resume.enabledSections.qualities && resume.qualities.length > 0 && (
            <div className="mt-6">
              <ResumeStringSection
                title="Qualities"
                items={resume.qualities}
                accent={accent}
              />
            </div>
          )}

          <div className="mt-6">
            <ResumeSectionTitle accent={accent}>Languages</ResumeSectionTitle>
            <ResumeLanguageList resume={resume} />
          </div>

          {resume.enabledSections.signature && resume.signature && (
            <div className="mt-6">
              <ResumeFooterText
                title="Signature"
                value={resume.signature}
                accent={accent}
              />
            </div>
          )}
        </aside>

        <main className="p-6 text-slate-800">
          <ResumeSummary resume={resume} accent={accent} />

          <div className="mt-6">
            <ResumeExperienceList
              resume={resume}
              accent={accent}
              compact
              isPdf={isPdf}
            />
          </div>

          {resume.enabledSections.internships && resume.internships.length > 0 && (
            <div className="mt-6">
              <ResumeInternshipsList resume={resume} accent={accent} />
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-8">
            <div>
              <ResumeEducationList resume={resume} accent={accent} />

              {resume.enabledSections.courses && resume.courses.length > 0 && (
                <div className="mt-6">
                  <ResumeCoursesList resume={resume} accent={accent} />
                </div>
              )}

              {resume.enabledSections.references && resume.references.length > 0 && (
                <div className="mt-6">
                  <ResumeReferencesList resume={resume} accent={accent} />
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
                <div className="mt-6">
                  <ResumeAchievementsList resume={resume} accent={accent} />
                </div>
              )}

              {resume.enabledSections.extracurricularActivities &&
                resume.extracurricularActivities.length > 0 && (
                  <div className="mt-6">
                    <ResumeStringSection
                      title="Extracurricular Activities"
                      items={resume.extracurricularActivities}
                      accent={accent}
                    />
                  </div>
                )}
            </div>
          </div>

          {resume.enabledSections.footer && resume.footer && (
            <div className="mt-6">
              <ResumeFooterText title="Footer" value={resume.footer} accent={accent} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};