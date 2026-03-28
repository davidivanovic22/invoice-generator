import { ResumeData } from '../../../types/resume';
import { ResumeContactListBlock } from '../blocks/ResumeContactListBlock';
import { ResumeLanguageListBlock } from '../blocks/ResumeLanguageListBlock';
import { ResumePhotoBlock } from '../blocks/ResumePhotoBlock';
import { ResumeSectionTitleBlock } from '../blocks/ResumeSectionTitleBlock';
import {
    ResumeEducationList,
    ResumeFooterText,
    ResumeSkillGrid,
    ResumeSummary
} from './ResumeBlocks';
import { resumePaperClassName, resumePaperStyle } from './shared';

type Props = {
    resume: ResumeData;
    isPdf?: boolean;
};

export const ResumeArchedProfile = ({ resume, isPdf = false }: Props) => {
    const accent = resume.editorSettings.accentColor || '#6b7280';

    const visibleSkills = resume.skills
        .filter((skill) => skill.name.trim().length > 0 && skill.percent > 0)
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 8);

    const visibleExperience = resume.experience.filter(
        (item) =>
            item.role.trim().length > 0 ||
            item.company.trim().length > 0 ||
            item.bullets.some((bullet) => bullet.trim().length > 0)
    );

    const visibleAchievements = resume.achievements.filter(
        (item) => item.title.trim().length > 0 || (item.description ?? '').trim().length > 0
    );

    return (
        <div
            className={`${resumePaperClassName} rounded-none bg-[#f3f4f6]`}
            style={{
                ...resumePaperStyle,
                fontSize: `${resume.editorSettings.baseFontSize}px`
            }}
        >
            <div className="grid h-full grid-cols-[290px_1fr]" style={{
                minHeight: resumePaperStyle.minHeight
            }}>
                <aside className="bg-[#e5e7eb] px-8 pb-8 pt-8">
                    <div className="mx-auto w-full max-w-[220px]">
                        <div className="overflow-hidden rounded-t-[120px] bg-[#b4b8be] px-4 pt-4">
                            <div className="rounded-full border-[8px] border-white/80 p-1">
                                <ResumePhotoBlock
                                    photo={resume.personal.photo}
                                    alt={resume.personal.fullName}
                                    rounded="rounded-full"
                                    sizeClassName="h-[180px] w-[180px]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-10">
                        <ResumeEducationList resume={resume} accent={accent} />
                    </div>

                    {visibleSkills.length > 0 && (
                        <div className="mt-8">
                            <ResumeSectionTitleBlock accent={accent}>Skills</ResumeSectionTitleBlock>
                            <ResumeSkillGrid
                                skills={visibleSkills}
                                accent={accent}
                                isPdf={isPdf}
                                showPercent={true}
                            />
                        </div>
                    )}

                    {resume.languages.length > 0 && (
                        <div className="mt-8">
                            <ResumeSectionTitleBlock accent={accent}>Languages</ResumeSectionTitleBlock>
                            <ResumeLanguageListBlock resume={resume} ></ResumeLanguageListBlock>
                        </div>
                    )}

                    <div className="mt-8">
                        <ResumeSectionTitleBlock accent={accent}>Contact</ResumeSectionTitleBlock>
                        <ResumeContactListBlock resume={resume} />
                    </div> 
                </aside>

                <main className="bg-[#f9fafb] px-10 pb-8 pt-10">
                    <header>
                        <h1 className="text-[34px] font-light uppercase tracking-[0.2em] text-slate-700">
                            {resume.personal.fullName}
                        </h1>
                        <div className="mt-2 text-[18px] font-medium tracking-[0.14em] text-slate-500">
                            {resume.personal.title}
                        </div>
                    </header>

                    <div className="mt-10">
                        <ResumeSummary resume={resume} accent={accent} />
                    </div>

                    {visibleExperience.length > 0 && (
                        <div className="mt-10">
                            <ResumeSectionTitleBlock accent={accent}>Experience</ResumeSectionTitleBlock>

                            <div className="relative ml-3 border-l-2 border-slate-400 pl-8">
                                {visibleExperience.map((exp, index) => (
                                    <article
                                        key={exp.id}
                                        className={index === 0 ? 'pb-10' : 'py-10'}
                                    >
                                        <span
                                            className="absolute -left-[11px] mt-1 h-5 w-5 rounded-full border-2 border-slate-500 bg-white"
                                            style={{ top: `${index * 0}px` }}
                                        />

                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="text-[17px] font-extrabold text-slate-900">
                                                    {exp.role}
                                                </div>

                                                <div className="mt-1 text-[14px] font-semibold text-slate-700">
                                                    {[exp.company, exp.project, exp.location]
                                                        .filter(Boolean)
                                                        .join(' • ')}
                                                </div>
                                            </div>

                                            <div className="shrink-0 text-[14px] text-slate-500">
                                                {exp.start} - {exp.end}
                                            </div>
                                        </div>

                                        {exp.bullets.some((bullet) => bullet.trim().length > 0) && (
                                            <div className="mt-3 space-y-2 text-[14px] leading-6 text-slate-700">
                                                {exp.bullets
                                                    .filter((bullet) => bullet.trim().length > 0)
                                                    .map((bullet, bulletIndex) => (
                                                        <div key={`${exp.id}-bullet-${bulletIndex}`}>{bullet}</div>
                                                    ))}
                                            </div>
                                        )}
                                    </article>
                                ))}
                            </div>
                        </div>
                    )}

                    {resume.enabledSections.achievements && visibleAchievements.length > 0 && (
                        <div className="mt-10">
                            <ResumeSectionTitleBlock accent={accent}>Achievement</ResumeSectionTitleBlock>

                            <div className="grid grid-cols-2 gap-8">
                                {visibleAchievements.map((item) => (
                                    <article key={item.id}>
                                        <div className="text-[16px] font-bold text-slate-900">
                                            {item.title}
                                        </div>

                                        {item.description ? (
                                            <div className="mt-2 text-[14px] leading-6 text-slate-700">
                                                {item.description}
                                            </div>
                                        ) : null}
                                    </article>
                                ))}
                            </div>
                        </div>
                    )}

                    {resume.enabledSections.footer && resume.footer && (
                        <div className="mt-10">
                            <ResumeFooterText title="Footer" value={resume.footer} accent={accent} />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};