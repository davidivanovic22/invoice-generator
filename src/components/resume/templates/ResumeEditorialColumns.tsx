import { ResumeData } from "../../../types/resume";
import { ResumeContactListBlock } from "../blocks/ResumeContactListBlock";
import { ResumeLanguageListBlock } from "../blocks/ResumeLanguageListBlock";
import { ResumePhotoBlock } from "../blocks/ResumePhotoBlock";
import { ResumeSectionTitleBlock } from "../blocks/ResumeSectionTitleBlock";
import {
    ResumeAchievementsList,
    ResumeCertificatesList,
    ResumeCoursesList,
    ResumeDotPercentageRatings,
    ResumeEducationList,
    ResumeExperienceList,
    ResumeFooterText,
    ResumeInternshipsList,
    ResumeReferencesList,
    ResumeSkillGrid,
    ResumeStringSection,
    ResumeSummary
} from "./ResumeBlocks";
import { resumePaperClassName, resumePaperStyle } from "./shared";

type Props = {
  resume: ResumeData;
  isPdf?: boolean;
};

export const ResumeEditorialColumns = ({ resume, isPdf = false }: Props) => {
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
          gridTemplateColumns: "1.1fr 0.55fr",
          minHeight: resumePaperStyle.minHeight
        }}
      >
        <main className="p-10 text-slate-800">
          <h1 className="text-[34px] font-bold leading-tight text-slate-900">
            {resume.personal.fullName}
          </h1>
          <p className="mt-2 text-[18px]" style={{ color: accent }}>
            {resume.personal.title}
          </p>

          <div className="mt-8">
            <ResumeSummary resume={resume} accent={accent} />
          </div>

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

          <div className="mt-8 grid grid-cols-2 gap-10">
            <div>
              <ResumeEducationList resume={resume} accent={accent} />
            </div>

            <div>
              <ResumeSectionTitleBlock accent={accent}>Skills</ResumeSectionTitleBlock>
              <ResumeSkillGrid
                skills={resume.skills}
                accent={accent}
                isPdf={isPdf}
              />
            </div>
          </div>

          {resume.enabledSections.courses && resume.courses.length > 0 && (
            <div className="mt-8">
              <ResumeCoursesList resume={resume} accent={accent} />
            </div>
          )}

          {resume.enabledSections.footer && resume.footer && (
            <div className="mt-8">
              <ResumeFooterText title="Footer" value={resume.footer} accent={accent} />
            </div>
          )}
        </main>

        <aside
          className="border-l p-8"
          style={{
            borderColor: `${accent}22`,
            background: "#fafaf9",
            minHeight: resumePaperStyle.minHeight
          }}
        >
          <div className="flex flex-col items-center">
            <ResumePhotoBlock
              photo={resume.personal.photo}
              alt={resume.personal.fullName}
              sizeClassName="h-24 w-24"
              rounded="rounded-full"
            />
          </div>

          <div className="mt-8">
            <ResumeSectionTitleBlock accent={accent}>Contact</ResumeSectionTitleBlock>
            <ResumeContactListBlock  resume={resume} ></ResumeContactListBlock>
          </div>

          <div className="mt-8">
            <ResumeSectionTitleBlock accent={accent}>Languages</ResumeSectionTitleBlock>
            <ResumeLanguageListBlock resume={resume} ></ResumeLanguageListBlock>
          </div>

          {resume.enabledSections.qualities && resume.qualities.length > 0 && (
            <div className="mt-8">
              <ResumeDotPercentageRatings
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

          {resume.enabledSections.signature && resume.signature && (
            <div className="mt-8">
              <ResumeFooterText
                title="Signature"
                value={resume.signature}
                accent={accent}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};