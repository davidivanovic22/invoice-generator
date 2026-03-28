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

          <div className="mt-6">
            <ResumeSectionTitle accent={accent}>Languages</ResumeSectionTitle>
            <ResumeLanguageList resume={resume} />
          </div>
        </aside>

        <main className="p-6 text-slate-800">
          <ResumeSummary resume={resume} accent={accent} />

          <div className="mt-6">
            <ResumeExperienceList
              resume={resume}
              accent={accent}
              compact
            />
          </div>

          <div className="mt-6 grid grid-cols-[1fr] gap-6">
            <ResumeEducationList resume={resume} accent={accent} />
          </div>
        </main>
      </div>
    </div>
  );
};