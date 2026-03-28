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

export const ResumeSidebarStacked = ({ resume, isPdf = false }: { resume: ResumeData; isPdf?: boolean }) => {
    const accent = resume.editorSettings.accentColor;

    return (
        <div
            className={`${resumePaperClassName} rounded-none`}
            style={{ ...resumePaperStyle, fontSize: `${resume.editorSettings.baseFontSize}px` }}
        >
            <div className="grid min-h-full grid-cols-[240px_1fr]">
                <aside className="p-8 text-white" style={{ background: accent }}>
                    <div className="flex flex-col items-center pb-6">
                        <ResumePhoto
                            photo={resume.personal.photo}
                            alt={resume.personal.fullName}
                            light
                            sizeClassName="h-28 w-28"
                        />
                    </div>

                    <h1 className="text-[24px] font-bold leading-tight">{resume.personal.fullName}</h1>
                    <p className="mt-2 text-sm text-white/80">{resume.personal.title}</p>

                    <div className="mt-8">
                        <ResumeSectionTitle accent={accent} light>
                            Contact
                        </ResumeSectionTitle>
                        <ResumeContactList resume={resume} light />
                    </div>

                    <div className="mt-8">
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

                    <div className="mt-8">
                        <ResumeSectionTitle accent={accent} light>
                            Languages
                        </ResumeSectionTitle>
                        <ResumeLanguageList resume={resume} light />
                    </div>
                </aside>

                <main className="p-8">
                    <ResumeSummary resume={resume} accent={accent} />
                    <div className="mt-8">
                        <ResumeExperienceList resume={resume} accent={accent}
                            isPdf={isPdf} compact />
                    </div>
                    <div className="mt-8">
                        <ResumeEducationList resume={resume} accent={accent} />
                    </div>
                </main>
            </div>
        </div>
    );
};