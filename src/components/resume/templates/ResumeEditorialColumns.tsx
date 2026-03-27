import { ResumeData } from "../../../types/resume";
import { resumePaperClassName, resumePaperStyle } from "./shared";
import {
  ResumeContactList,
  ResumeEducationList,
  ResumeExperienceList,
  ResumeLanguageList,
  ResumePhoto,
  ResumeSectionTitle,
  ResumeSkillGrid,
  ResumeSummary
} from "./ResumeBlocks";

export const ResumeEditorialColumns = ({ resume, isPdf = false }: { resume: ResumeData; isPdf?: boolean }) => {
  const accent = resume.editorSettings.accentColor;

  return (
    <div
      className={`${resumePaperClassName} rounded-none`}
      style={{ ...resumePaperStyle, fontSize: `${resume.editorSettings.baseFontSize}px` }}
    >
      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: "1fr 280px",
          minHeight: resumePaperStyle.minHeight
        }}
      >
        <main className="p-10">
          <h1 className="text-[34px] font-bold text-slate-900">{resume.personal.fullName}</h1>
          <p className="mt-2 text-[18px]" style={{ color: accent }}>
            {resume.personal.title}
          </p>

          <div className="mt-8">
            <ResumeSummary resume={resume} accent={accent} />
          </div>

          <div className="mt-8">
            <ResumeExperienceList resume={resume} accent={accent} isPdf compact />
          </div>

          <div className="mt-8">
            <ResumeEducationList resume={resume} accent={accent} />
          </div>
        </main>

        <aside
          className="h-full border-l p-8"
          style={{
            borderColor: `${accent}22`,
            background: `${accent}08`,
            minHeight: resumePaperStyle.minHeight
          }}
        >
          <div className="flex justify-center">
            <ResumePhoto
              photo={resume.personal.photo}
              alt={resume.personal.fullName}
              sizeClassName="h-28 w-28"
            />
          </div>

          <div className="mt-8">
            <ResumeSectionTitle accent={accent}>Contact</ResumeSectionTitle>
            <ResumeContactList resume={resume} />
          </div>

          <div className="mt-8">
            <ResumeSectionTitle accent={accent}>Skills</ResumeSectionTitle>
            <ResumeSkillGrid skills={resume.skills} accent={accent} isPdf={isPdf} />
          </div>

          <div className="mt-8">
            <ResumeSectionTitle accent={accent}>Languages</ResumeSectionTitle>
            <ResumeLanguageList resume={resume} />
          </div>
        </aside>
      </div>
    </div>
  );
};