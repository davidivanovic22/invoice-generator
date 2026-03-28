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

export const ResumeTechClean = ({ resume, isPdf = false }: Props) => {
  const accent = resume.editorSettings.accentColor;

  return (
    <div
      className={`${resumePaperClassName} rounded-none p-10 font-mono text-slate-900`}
      style={{
        ...resumePaperStyle,
        fontSize: `${Math.max(12, resume.editorSettings.baseFontSize - 1)}px`
      }}
    >
      <header className="mb-8 border-b pb-6" style={{ borderColor: `${accent}33` }}>
        <div className="flex items-start gap-6">
          <ResumePhoto
            photo={resume.personal.photo}
            alt={resume.personal.fullName}
            sizeClassName="h-20 w-20"
            rounded="rounded-xl"
          />

          <div className="flex-1">
            <h1 className="text-[28px] font-bold">{resume.personal.fullName}</h1>
            <div className="mt-1" style={{ color: accent }}>
              {resume.personal.title}
            </div>
            <div className="mt-3 text-[12px] text-slate-500">
              {resume.personal.email} | {resume.personal.phone}
            </div>
            <div className="mt-1 text-[12px] text-slate-500">
              {resume.personal.address}
            </div>
          </div>
        </div>
      </header>

      <ResumeSummary resume={resume} accent={accent} />

      <div className="mt-8">
        <ResumeExperienceList
          resume={resume}
          accent={accent}
          compact
          isPdf={isPdf}
        />
      </div>

      {resume.enabledSections.internships && resume.internships.length > 0 && (
        <div className="mt-8">
          <ResumeInternshipsList resume={resume} accent={accent} />
        </div>
      )}

      <div className="mt-8 grid grid-cols-[1fr_1fr] items-start gap-8">
        <div>
          <ResumeSectionTitle accent={accent}>Skills</ResumeSectionTitle>
          <ResumeSkillGrid
            skills={resume.skills}
            accent={accent}
            isPdf={isPdf}
          />

          {resume.enabledSections.qualities && resume.qualities.length > 0 && (
            <div className="mt-8">
              <ResumeStringSection
                title="Qualities"
                items={resume.qualities}
                accent={accent}
              />
            </div>
          )}

          {resume.enabledSections.references && resume.references.length > 0 && (
            <div className="mt-8">
              <ResumeReferencesList resume={resume} accent={accent} />
            </div>
          )}
        </div>

        <div>
          <ResumeEducationList resume={resume} accent={accent} />

          <div className="mt-8">
            <ResumeSectionTitle accent={accent}>Languages</ResumeSectionTitle>
            <ResumeLanguageList resume={resume} />
          </div>

          {resume.enabledSections.courses && resume.courses.length > 0 && (
            <div className="mt-8">
              <ResumeCoursesList resume={resume} accent={accent} />
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

      {resume.enabledSections.footer && resume.footer && (
        <div className="mt-8">
          <ResumeFooterText title="Footer" value={resume.footer} accent={accent} />
        </div>
      )}
    </div>
  );
};