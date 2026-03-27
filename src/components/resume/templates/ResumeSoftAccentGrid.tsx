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

export const ResumeSoftAccentGrid = ({ resume, isPdf = false }: { resume: ResumeData; isPdf?: boolean }) => {
    const accent = resume.editorSettings.accentColor;

    return (
        <div
            className={`${resumePaperClassName} rounded-none`}
            style={{ ...resumePaperStyle, fontSize: `${resume.editorSettings.baseFontSize}px` }}
        >
            <div
                className="grid h-full"
                style={{
                    gridTemplateColumns: "220px 1fr",
                    minHeight: resumePaperStyle.minHeight
                }}
            >
                <aside
                    className="h-full p-8"
                    style={{
                        background: `${accent}12`,
                        minHeight: resumePaperStyle.minHeight
                    }}
                >
                    <div className="flex justify-center">
                        <ResumePhoto
                            photo={resume.personal.photo}
                            alt={resume.personal.fullName}
                            sizeClassName="h-24 w-24"
                        />
                    </div>

                    <div className="mt-6 text-center">
                        <div className="text-[22px] font-bold text-slate-900">{resume.personal.fullName}</div>
                        <div className="mt-1 text-sm" style={{ color: accent }}>
                            {resume.personal.title}
                        </div>
                    </div>

                    <div className="mt-8">
                        <ResumeSectionTitle accent={accent}>Contact</ResumeSectionTitle>
                        <ResumeContactList resume={resume} />
                    </div>

                    <div className="mt-8">
                        <ResumeSectionTitle accent={accent}>Languages</ResumeSectionTitle>
                        <ResumeLanguageList resume={resume} />
                    </div>
                </aside>

                <main className="p-8">
                    <ResumeSummary resume={resume} accent={accent} />

                    <div className="mt-8">
                        <ResumeExperienceList resume={resume} accent={accent} isPdf={isPdf} compact />
                    </div>

                    <div className="mt-8 grid grid-cols-[1fr_1fr] items-start gap-10">
                        <div>
                            <ResumeEducationList resume={resume} accent={accent} />
                        </div>

                        <div>
                            <ResumeSectionTitle accent={accent}>Skills</ResumeSectionTitle>
                            <ResumeSkillGrid skills={resume.skills} accent={accent} isPdf={isPdf} />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};