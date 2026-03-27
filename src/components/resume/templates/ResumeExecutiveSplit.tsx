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

export const ResumeExecutiveSplit = ({ resume, isPdf= false }: { resume: ResumeData, isPdf?: boolean }) => {
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
          gridTemplateColumns: "255px 1fr",
          minHeight: resumePaperStyle.minHeight
        }}
      >
        <aside
          className="h-full p-7 text-white"
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
              sizeClassName="h-32 w-32"
            />

            <h1 className="mt-4 w-full text-left text-[20px] font-bold leading-tight">
              {resume.personal.fullName}
            </h1>
            <p className="mt-1 w-full text-left text-sm text-white/80">
              {resume.personal.title}
            </p>
          </div>

          <section className="mt-6">
            <ResumeSectionTitle accent={accent} light>
              Contact
            </ResumeSectionTitle>

            <ResumeContactList resume={resume} light />
          </section>

          <section className="mt-7">
            <ResumeSectionTitle accent={accent} light>
              Skills
            </ResumeSectionTitle>

            <ResumeSkillGrid
              skills={resume.skills}
              accent={accent}
              light
            />
          </section>

          <section className="mt-7">
            <ResumeSectionTitle accent={accent} light>
              Languages
            </ResumeSectionTitle>

            <ResumeLanguageList resume={resume} light />
          </section>
        </aside>

        <main className="p-7 text-slate-800">
          <ResumeSummary resume={resume} accent={accent} />

          <section className="mt-8">
            <ResumeExperienceList
              resume={resume}
              accent={accent}
              compact
            />
          </section>

          <section className="mt-8 grid grid-cols-[1fr_1fr] items-start gap-10">
            <div>
              <ResumeEducationList resume={resume} accent={accent} />
            </div>

            <div>
              <ResumeSectionTitle accent={accent}>
                Skills
              </ResumeSectionTitle>

              <ResumeSkillGrid
                skills={resume.skills}
                accent={accent}
                isPdf={isPdf}
              />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};