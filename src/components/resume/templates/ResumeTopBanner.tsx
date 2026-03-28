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

export const ResumeTopBanner = ({ resume, isPdf = false }: Props) => {
    const accent = resume.editorSettings.accentColor;

    return (
        <div
            className={`${resumePaperClassName} rounded-none overflow-hidden`}
            style={{
                ...resumePaperStyle,
                fontSize: `${resume.editorSettings.baseFontSize}px`
            }}
        >
            <header
                className="px-10 py-8 text-white"
                style={{ background: accent }}
            >
                <div className="flex items-center gap-6">
                    <ResumePhotoBlock
                        photo={resume.personal.photo}
                        alt={resume.personal.fullName}
                        light
                        sizeClassName="h-24 w-24"
                        rounded="rounded-full"
                    />

                    <div className="flex-1">
                        <h1 className="text-[32px] font-bold leading-tight">
                            {resume.personal.fullName}
                        </h1>
                        <p className="mt-2 text-[18px] text-white/90">
                            {resume.personal.title}
                        </p>
                        <div className="mt-3 text-sm text-white/85">
                            {resume.personal.email} • {resume.personal.phone}
                        </div>
                        <div className="mt-1 text-sm text-white/85">
                            {resume.personal.address}
                        </div>
                    </div>
                </div>
            </header>

            <main className="grid grid-cols-[1.35fr_0.65fr] gap-8 p-10 text-slate-800">
                <div>
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
                    <ResumeSectionTitleBlock accent={accent}>Contact</ResumeSectionTitleBlock>
                    <ResumeContactListBlock resume={resume} />

                    <div className="mt-8">
                        <ResumeSectionTitleBlock accent={accent}>Skills</ResumeSectionTitleBlock>
                        <ResumeSkillGrid
                            skills={resume.skills}
                            accent={accent}
                            isPdf={isPdf}
                        />
                    </div>

                    <div className="mt-8">
                        <ResumeEducationList resume={resume} accent={accent} />
                    </div>

                    {resume.enabledSections.courses && resume.courses.length > 0 && (
                        <div className="mt-8">
                            <ResumeCoursesList resume={resume} accent={accent} />
                        </div>
                    )}

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

                    {resume.enabledSections.references && resume.references.length > 0 && (
                        <div className="mt-8">
                            <ResumeReferencesList resume={resume} accent={accent} />
                        </div>
                    )}
                </div>
            </main>

            {(resume.enabledSections.achievements && resume.achievements.length > 0) ||
                (resume.enabledSections.footer && resume.footer) ? (
                <div className="px-10 pb-10">
                    {resume.enabledSections.achievements && resume.achievements.length > 0 && (
                        <div className="mt-2">
                            <ResumeAchievementsList resume={resume} accent={accent} />
                        </div>
                    )}

                    {resume.enabledSections.footer && resume.footer && (
                        <div className="mt-8">
                            <ResumeFooterText title="Footer" value={resume.footer} accent={accent} />
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
};