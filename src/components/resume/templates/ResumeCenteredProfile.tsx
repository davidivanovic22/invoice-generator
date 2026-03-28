import { ResumeData } from "../../../types/resume";
import { resumePaperClassName, resumePaperStyle } from "./shared";
import {
  ResumeAchievementsList,
  ResumeCertificatesList,
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

export const ResumeCenteredProfile = ({ resume, isPdf = false }: Props) => {
  const accent = resume.editorSettings.accentColor;

  return (
    <div
      className={`${resumePaperClassName} rounded-none p-10`}
      style={{
        ...resumePaperStyle,
        fontSize: `${resume.editorSettings.baseFontSize}px`
      }}
    >
      <header
        className="flex flex-col items-center border-b pb-8 text-center"
        style={{ borderColor: `${accent}33` }}
      >
        <ResumePhoto
          photo={resume.personal.photo}
          alt={resume.personal.fullName}
          sizeClassName="h-28 w-28"
          rounded="rounded-full"
        />
        <h1 className="mt-5 text-[34px] font-bold text-slate-900">
          {resume.personal.fullName}
        </h1>
        <p className="mt-2 text-[18px]" style={{ color: accent }}>
          {resume.personal.title}
        </p>
        <div className="mt-3 text-sm text-slate-500">
          {resume.personal.email} • {resume.personal.phone}
        </div>
        <div className="mt-1 text-sm text-slate-500">{resume.personal.address}</div>
      </header>

      <div className="mt-8">
        <ResumeSummary resume={resume} accent={accent} />
      </div>

      <div className="mt-8 grid grid-cols-[1.1fr_0.9fr] items-start gap-10">
        <div>
          <ResumeExperienceList
            resume={resume}
            accent={accent}
            isPdf={isPdf}
          />

          {resume.enabledSections.internships && resume.internships.length > 0 && (
            <div className="mt-8">
              <ResumeInternshipsList resume={resume} accent={accent} />
            </div>
          )}

          {resume.enabledSections.references && resume.references.length > 0 && (
            <div className="mt-8">
              <ResumeReferencesList resume={resume} accent={accent} />
            </div>
          )}
        </div>

        <div>
          <ResumeSectionTitle accent={accent}>Skills</ResumeSectionTitle>
          <ResumeSkillGrid
            skills={resume.skills}
            accent={accent}
            isPdf={isPdf}
          />

          <div className="mt-8">
            <ResumeEducationList resume={resume} accent={accent} />
          </div>

          {resume.enabledSections.courses && resume.courses.length > 0 && (
            <div className="mt-8">
              <ResumeCoursesList resume={resume} accent={accent} />
            </div>
          )}

          <div className="mt-8">
            <ResumeSectionTitle accent={accent}>Languages</ResumeSectionTitle>
            <ResumeLanguageList resume={resume} />
          </div>

          {resume.enabledSections.qualities && resume.qualities.length > 0 && (
            <div className="mt-8">
              <ResumeStringSection
                title="Qualities"
                items={resume.qualities}
                accent={accent}
              />
            </div>
          )}

          {resume.enabledSections.certificates && resume.certificates.length > 0 && (
            <div className="mt-8">
              <ResumeCertificatesList resume={resume} accent={accent} />
            </div>
          )}

          {resume.enabledSections.achievements && resume.achievements.length > 0 && (
            <div className="mt-8">
              <ResumeAchievementsList resume={resume} accent={accent} />
            </div>
          )}
        </div>
      </div>

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

      {resume.enabledSections.footer && resume.footer && (
        <div className="mt-8">
          <ResumeFooterText title="Footer" value={resume.footer} accent={accent} />
        </div>
      )}
    </div>
  );
};