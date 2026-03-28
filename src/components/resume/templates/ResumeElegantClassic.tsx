import { ResumeData } from "../../../types/resume";
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
    ResumeSummary
} from "./ResumeBlocks";
import { resumePaperClassName, resumePaperStyle } from "./shared";

type Props = {
    resume: ResumeData;
    isPdf?: boolean;
};

export const ResumeElegantClassic = ({ resume, isPdf = false }: Props) => {
    const accent = resume.editorSettings.accentColor;

    return (
        <div
            className={`${resumePaperClassName} rounded-none border p-12 font-serif text-slate-900`}
            style={{
                ...resumePaperStyle,
                fontSize: `${resume.editorSettings.baseFontSize}px`
            }}
        >
            <header className="mb-8 text-center">
                <div className="flex flex-col items-center">
                    <ResumePhotoBlock
                        photo={resume.personal.photo}
                        alt={resume.personal.fullName}
                        sizeClassName="h-24 w-24"
                        rounded="rounded-md"
                    />

                    <h1 className="mt-5 text-[32px] font-semibold leading-tight">
                        {resume.personal.fullName}
                    </h1>

                    <p className="mt-2 text-[15px]" style={{ color: accent }}>
                        {resume.personal.title}
                    </p>

                    <div className="mt-3 text-sm text-slate-600">
                        {resume.personal.email} • {resume.personal.phone}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                        {resume.personal.address}
                    </div>
                </div>
            </header>

            <div className="mb-8 border-t" style={{ borderColor: `${accent}55` }} />

            <ResumeSummary resume={resume} accent={accent} />

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

            <div className="mt-8 grid grid-cols-[1fr_1fr] items-start gap-10">
                <div>
                    <ResumeEducationList resume={resume} accent={accent} />

                    {resume.enabledSections.courses && resume.courses.length > 0 && (
                        <div className="mt-8">
                            <ResumeCoursesList resume={resume} accent={accent} />
                        </div>
                    )}

                    {resume.enabledSections.references && resume.references.length > 0 && (
                        <div className="mt-8">
                            <ResumeReferencesList resume={resume} accent={accent} />
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

                    {resume.enabledSections.certificates && resume.certificates.length > 0 && (
                        <div className="mt-8">
                            <ResumeCertificatesList resume={resume} accent={accent} />
                        </div>
                    )}
                </div>
            </div>

            {resume.enabledSections.achievements && resume.achievements.length > 0 && (
                <div className="mt-8">
                    <ResumeAchievementsList resume={resume} accent={accent} />
                </div>
            )}

            {resume.enabledSections.footer && resume.footer && (
                <div className="mt-8">
                    <ResumeFooterText title="Footer" value={resume.footer} accent={accent} />
                </div>
            )}
        </div>
    );
};