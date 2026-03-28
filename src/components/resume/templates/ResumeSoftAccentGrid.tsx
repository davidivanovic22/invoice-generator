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

export const ResumeSoftAccentGrid = ({ resume, isPdf = false }: Props) => {
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
                    gridTemplateColumns: "210px 1fr",
                    minHeight: resumePaperStyle.minHeight
                }}
            >
                <aside
                    className="border-r p-7"
                    style={{
                        background: `${accent}0D`,
                        borderColor: `${accent}22`,
                        minHeight: resumePaperStyle.minHeight
                    }}
                >
                    <div className="flex flex-col items-center">
                        <ResumePhotoBlock
                            photo={resume.personal.photo}
                            alt={resume.personal.fullName}
                            sizeClassName="h-24 w-24"
                            rounded="rounded-2xl"
                        />
                        <h1 className="mt-4 w-full text-center text-[20px] font-bold text-slate-900">
                            {resume.personal.fullName}
                        </h1>
                        <p className="mt-1 w-full text-center text-sm" style={{ color: accent }}>
                            {resume.personal.title}
                        </p>
                    </div>

                    <div className="mt-7">
                        <ResumeSectionTitleBlock accent={accent}>Contact</ResumeSectionTitleBlock>
                        <ResumeContactListBlock resume={resume} ></ResumeContactListBlock>
                    </div>

                    <div className="mt-7">
                        <ResumeSectionTitleBlock accent={accent}>Languages</ResumeSectionTitleBlock>
                        <ResumeLanguageListBlock resume={resume} ></ResumeLanguageListBlock>
                    </div>

                    {resume.enabledSections.references && resume.references.length > 0 && (
                        <div className="mt-7">
                            <ResumeReferencesList resume={resume} accent={accent} />
                        </div>
                    )}
                </aside>

                <main className="p-8 text-slate-800">
                    <ResumeSummary resume={resume} accent={accent} />

                    <div className="mt-8 grid grid-cols-[1.2fr_0.8fr] items-start gap-10">
                        <div>
                            <ResumeExperienceList
                                resume={resume}
                                accent={accent}
                                compact
                                isPdf={isPdf}
                            />

                            {resume.enabledSections.internships && resume.internships.length > 0 && (
                                <div className="mt-8">
                                    <ResumeInternshipsList resume={resume} accent={accent} />
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

                        <div>
                            <ResumeSectionTitleBlock accent={accent}>Skills</ResumeSectionTitleBlock>
                            <ResumeSkillGrid
                                skills={resume.skills}
                                accent={accent}
                                isPdf={isPdf}
                            />

                            {resume.enabledSections.qualities && resume.qualities.length > 0 && (
                                <div className="mt-8">
                                    <ResumeDotPercentageRatings
                                        items={resume.qualities}
                                        accent={accent}
                                    />
                                </div>
                            )}

                            <div className="mt-8">
                                <ResumeEducationList resume={resume} accent={accent} />
                            </div>

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

                            {resume.enabledSections.achievements && resume.achievements.length > 0 && (
                                <div className="mt-8">
                                    <ResumeAchievementsList resume={resume} accent={accent} />
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