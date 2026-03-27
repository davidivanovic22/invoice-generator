import { ResumeData } from "../../../types/resume";
import { resumePaperClassName, resumePaperStyle } from "./shared";
import {
  ResumeEducationList,
  ResumeExperienceList,
  ResumeLanguageList,
  ResumePhoto,
  ResumeSectionTitle,
  ResumeSkillGrid,
  ResumeSummary
} from "./ResumeBlocks";

export const ResumeTopBanner = ({ resume, isPdf = false }: { resume: ResumeData, isPdf?: boolean }) => {
  const accent = resume.editorSettings.accentColor;

  return (
    <div
      className={`${resumePaperClassName} rounded-none`}
      style={{ ...resumePaperStyle, fontSize: `${resume.editorSettings.baseFontSize}px` }}
    >
      <div className="border-b px-10 py-8" style={{ borderColor: `${accent}33`, background: `${accent}10` }}>
        <div className="flex items-center gap-6">
          <ResumePhoto
            photo={resume.personal.photo}
            alt={resume.personal.fullName}
            sizeClassName="h-24 w-24"
            rounded="rounded-full"
          />

          <div className="flex-1">
            <h1 className="text-[34px] font-bold text-slate-900">{resume.personal.fullName}</h1>
            <p className="mt-1 text-[18px]" style={{ color: accent }}>
              {resume.personal.title}
            </p>
            <div className="mt-3 text-sm text-slate-500">
              {resume.personal.email} • {resume.personal.phone} • {resume.personal.address}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1.2fr_0.8fr] items-start gap-10 p-10">
        <div>
          <ResumeSummary resume={resume} accent={accent} />
          <div className="mt-8">
            <ResumeExperienceList resume={resume} accent={accent} isPdf={isPdf} />
          </div>
        </div>

        <div>
          <ResumeSectionTitle accent={accent}>Skills</ResumeSectionTitle>
          <ResumeSkillGrid skills={resume.skills} accent={accent} isPdf={isPdf} />

          <div className="mt-8">
            <ResumeEducationList resume={resume} accent={accent} />
          </div>

          <div className="mt-8">
            <ResumeSectionTitle accent={accent}>Languages</ResumeSectionTitle>
            <ResumeLanguageList resume={resume} />
          </div>
        </div>
      </div>
    </div>
  );
};