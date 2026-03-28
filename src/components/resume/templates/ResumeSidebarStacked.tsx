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

export const ResumeSidebarStacked = ({ resume, isPdf = false }: Props) => {
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
                    gridTemplateColumns: "290px 1fr",
                    minHeight: resumePaperStyle.minHeight
                }}
            >
                <aside
                    className="p-6 text-white"
                    style={{
                        background: "#111827",
                        minHeight: resumePaperStyle.minHeight
                    }}
                >
                    <div className="flex flex-col items-center">
                        <ResumePhotoBlock
                            photo={resume.personal.photo}
                            alt={resume.personal.fullName}
                            light
                            sizeClassName="h-24 w-24"
                            rounded="rounded-full"
                        />
                        <h1 className="mt-4 w-full text-center text-[20px] font-bold">
                            {resume.personal.fullName}
                        </h1>
                        <p className="mt-1 w-full text-center text-sm text-white/75">
                            {resume.personal.title}
                        </p>
                    </div>

                    <div className="mt-6">
                        <ResumeSectionTitleBlock accent={accent} light>
                            Contact
                        </ResumeSectionTitleBlock>
                        <ResumeContactListBlock resume={resume} light ></ResumeContactListBlock>
                    </div>

                    <div className="mt-6">
                        <ResumeSectionTitleBlock accent={accent} light>
                            Skills
                        </ResumeSectionTitleBlock>
                        <ResumeSkillGrid
                            skills={resume.skills}
                            accent={accent}
                            light
                            isPdf={isPdf}
                        />
                    </div>

                    {resume.enabledSections.qualities && resume.qualities.length > 0 && (
                        <div className="mt-6">
                            <ResumeDotPercentageRatings
                                items={resume.qualities}
                                accent={accent}
                                light
                            />
                        </div>
                    )}

                    <div className="mt-6">
                        <ResumeSectionTitleBlock accent={accent} light>
                            Languages
                        </ResumeSectionTitleBlock>
                        <ResumeLanguageListBlock resume={resume} light ></ResumeLanguageListBlock>
                    </div>

                    {resume.enabledSections.references && resume.references.length > 0 && (
                        <div className="mt-6">
                            <ResumeReferencesList resume={resume} accent={accent} light />
                        </div>
                    )}
                </aside>

                <main className="p-8 text-slate-800">
                    <ResumeSummary resume={resume} accent={accent} />

                    <div className="mt-8">
                        <ResumeExperienceList
                            resume={resume}
                            accent={accent}
                            compact
                            isPdf={isPdf}
                        />
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-8">
                        <div>
                            <ResumeEducationList resume={resume} accent={accent} />

                            {resume.enabledSections.courses && resume.courses.length > 0 && (
                                <div className="mt-8">
                                    <ResumeCoursesList resume={resume} accent={accent} />
                                </div>
                            )}

                            {resume.enabledSections.internships && resume.internships.length > 0 && (
                                <div className="mt-8">
                                    <ResumeInternshipsList resume={resume} accent={accent} />
                                </div>
                            )}
                        </div>

                        <div>
                            {resume.enabledSections.certificates && resume.certificates.length > 0 && (
                                <div>
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
                        </div>
                    </div>

                    {resume.enabledSections.footer && resume.footer && (
                        <div className="mt-8">
                            <ResumeFooterText title="Footer" value={resume.footer} accent={accent} />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};