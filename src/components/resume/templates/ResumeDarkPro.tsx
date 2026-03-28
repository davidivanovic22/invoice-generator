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

            <div className="space-y-2 text-[13px] text-white/90">
              <div>{resume.personal.phone}</div>
              <div className="break-all">{resume.personal.email}</div>
              <div>{resume.personal.address}</div>
              {resume.personal.linkedin ? (
                <div className="break-all">{resume.personal.linkedin}</div>
              ) : null}
              {resume.personal.github ? (
                <div className="break-all">{resume.personal.github}</div>
              ) : null}
              {resume.personal.website ? (
                <div className="break-all">{resume.personal.website}</div>
              ) : null}
            </div>
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

          <div className="mt-6">
            <ResumeSectionTitle accent={accent} light>
              Languages
            </ResumeSectionTitle>

            <ResumeLanguageList resume={resume} light />
          </div>
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

          <div className="mt-8">
            <ResumeEducationList resume={resume} accent={accent} light />
          </div>
        </main>
      </div>
    </div>
  );
};