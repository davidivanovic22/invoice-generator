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

export const ResumeCreativeGradient = ({ resume, isPdf = false }: Props) => {
  const accent = resume.editorSettings.accentColor;

  return (
    <div
      className={`${resumePaperClassName} rounded-none overflow-hidden`}
      style={{
        ...resumePaperStyle,
        fontSize: `${resume.editorSettings.baseFontSize}px`
      }}
    >
      <div
        className="p-10 text-white"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, #4f46e5 100%)`
        }}
      >
        <div className="flex items-start gap-6">
          <ResumePhoto
            photo={resume.personal.photo}
            alt={resume.personal.fullName}
            light
            sizeClassName="h-24 w-24"
            rounded="rounded-2xl"
          />

          <div className="flex-1">
            <h1 className="text-[34px] font-bold leading-tight">
              {resume.personal.fullName}
            </h1>

            <p className="mt-1 text-[18px] text-white/90">
              {resume.personal.title}
            </p>

            <div className="mt-3 text-sm text-white/80">
              {resume.personal.email} • {resume.personal.phone}
            </div>

            <div className="mt-1 text-sm text-white/80">
              {resume.personal.address}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1.1fr_0.9fr] items-start gap-8 p-10 text-slate-800">
        <div>
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

          {resume.enabledSections.achievements && resume.achievements.length > 0 && (
            <div className="mt-8">
              <ResumeAchievementsList resume={resume} accent={accent} />
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

          {resume.enabledSections.references && resume.references.length > 0 && (
            <div className="mt-8">
              <ResumeReferencesList resume={resume} accent={accent} />
            </div>
          )}
        </div>
      </div>

      {resume.enabledSections.footer && resume.footer && (
        <div className="px-10 pb-10">
          <ResumeFooterText title="Footer" value={resume.footer} accent={accent} />
        </div>
      )}
    </div>
  );
};