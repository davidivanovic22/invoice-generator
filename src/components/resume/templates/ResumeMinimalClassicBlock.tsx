import type { ReactNode } from 'react';
import { ResumeData } from '../../../types/resume';
import { ResumePhotoBlock } from '../blocks/ResumePhotoBlock';
import { resumePaperClassName, resumePaperStyle } from './shared';

type Props = {
    resume: ResumeData;
    isPdf?: boolean;
    pageIndex?: number;
};

type PageSection = {
    key: string;
    estimatedHeight: number;
    content: ReactNode;
};

type ResumePage = {
    leftSections: PageSection[];
    rightSections: PageSection[];
};

const LEFT_BG = '#e7e7e7';
const RIGHT_BG = '#f7f7f5';
const ACCENT = '#1d2129';
const ACCENT_DARK = '#11141a';
const PAGE_PADDING_Y = 36;
const USABLE_HEIGHT = 980;

const getVisibleContactRows = (resume: ResumeData) =>
    [
        ['Phone', resume.personal.phone],
        ['Email', resume.personal.email],
        ['Address', resume.personal.address],
        ['LinkedIn', resume.enabledPersonalFields.linkedin ? resume.personal.linkedin : undefined],
        ['GitHub', resume.enabledPersonalFields.github ? resume.personal.github : undefined],
        ['Website', resume.enabledPersonalFields.website ? resume.personal.website : undefined]
    ].filter((row): row is [string, string] => typeof row[1] === 'string' && row[1].trim().length > 0);

const getVisibleEducation = (resume: ResumeData) =>
    resume.education.filter(
        (item) =>
            (item.school ?? '').trim().length > 0 ||
            (item.degree ?? '').trim().length > 0 ||
            (item.start ?? '').trim().length > 0 ||
            (item.end ?? '').trim().length > 0
    );

const getVisibleExperience = (resume: ResumeData) =>
    resume.experience.filter(
        (item) =>
            (item.role ?? '').trim().length > 0 ||
            (item.company ?? '').trim().length > 0 ||
            (item.location ?? '').trim().length > 0 ||
            (item.project ?? '').trim().length > 0 ||
            item.bullets.some((bullet) => bullet.trim().length > 0)
    );

const getVisibleSkills = (resume: ResumeData) =>
    resume.skills
        .filter((skill) => (skill.name ?? '').trim().length > 0)
        .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));

const getVisibleLanguages = (resume: ResumeData) =>
    resume.languages.filter((lang) => (lang.name ?? '').trim().length > 0);

const getVisibleReferences = (resume: ResumeData) =>
    resume.references.filter(
        (ref) =>
            (ref.name ?? '').trim().length > 0 ||
            (ref.company ?? '').trim().length > 0 ||
            (ref.phone ?? '').trim().length > 0 ||
            (ref.email ?? '').trim().length > 0
    );

const RibbonTitle = ({ children }: { children: ReactNode }) => (
    <div className="relative mb-6">
        <div className="bg-[#1d2129] px-7 py-3 text-[20px] font-bold tracking-[0.02em] text-white">
            {children}
        </div>
        <div
            className="absolute right-0 top-full h-0 w-0"
            style={{
                borderTop: `18px solid ${ACCENT_DARK}`,
                borderLeft: '18px solid transparent'
            }}
        />
    </div>
);

const LeftProfileSection = ({ resume }: { resume: ResumeData }) => (
    <section className="px-6">
        <div className="flex justify-center">
            <div className="rounded-full border-[6px] border-[#bfc0c0] p-[6px]">
                <ResumePhotoBlock
                    photo={resume.personal.photo}
                    alt={resume.personal.fullName}
                    rounded="rounded-full"
                    sizeClassName="h-[185px] w-[185px]"
                />
            </div>
        </div>
    </section>
);

const LeftContactSection = ({ resume }: { resume: ResumeData }) => {
    const rows = getVisibleContactRows(resume);
    if (!rows.length) return null;

    return (
        <section>
            <RibbonTitle>Contact</RibbonTitle>

            <div className="space-y-6 px-6">
                {rows.map(([label, value], index) => (
                    <div key={`${label}-${index}`}>
                        <div className="text-[17px] font-bold text-[#1f232b]">{label}</div>
                        <div className="mt-1 break-words text-[14px] leading-6 text-[#474d57]">{value}</div>
                    </div>
                ))}
            </div>
        </section>
    );
};

const LeftEducationSection = ({ resume }: { resume: ResumeData }) => {
    const items = getVisibleEducation(resume);
    if (!items.length) return null;

    return (
        <section>
            <RibbonTitle>Education</RibbonTitle>

            <div className="space-y-7 px-6">
                {items.map((item) => (
                    <div key={item.id}>
                        <div className="text-[18px] font-bold text-[#1f232b]">{item.degree}</div>
                        <div className="mt-1 text-[14px] font-medium text-[#474d57]">{item.school}</div>
                        <div className="mt-1 text-[14px] text-[#5d6470]">
                            {[item.start, item.end].filter(Boolean).join(' - ')}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

const LeftSkillsSection = ({ resume }: { resume: ResumeData }) => {
    const items = getVisibleSkills(resume);
    if (!items.length) return null;

    return (
        <section>
            <RibbonTitle>Skills</RibbonTitle>

            <div className="px-7">
                <ul className="space-y-3 pl-5 text-[15px] leading-7 text-[#2b3038]">
                    {items.map((skill) => (
                        <li key={skill.id}>{skill.name}</li>
                    ))}
                </ul>
            </div>
        </section>
    );
};

const LeftLanguagesSection = ({ resume }: { resume: ResumeData }) => {
    const items = getVisibleLanguages(resume);
    if (!items.length) return null;

    return (
        <section>
            <RibbonTitle>Language</RibbonTitle>

            <div className="px-7">
                <ul className="space-y-3 pl-5 text-[15px] leading-7 text-[#2b3038]">
                    {items.map((lang) => (
                        <li key={lang.id}>
                            {lang.name}
                            {lang.level ? <span className="ml-2 text-[#6b7280]">({lang.level})</span> : null}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
};

const RightHeaderSection = ({ resume }: { resume: ResumeData }) => (
    <section className="px-10 pb-2 pt-10">
        <h1 className="whitespace-pre-line text-[54px] font-extrabold uppercase leading-[0.95] tracking-[0.01em] text-[#1d2129]">
            {(resume.personal.fullName || '').split(' ').length > 1
                ? (resume.personal.fullName || '')
                    .split(' ')
                    .reduce<string[]>((acc, part, index) => {
                        if (index % 2 === 0) {
                            acc.push(part);
                        } else {
                            acc[acc.length - 1] += ` ${part}`;
                        }
                        return acc;
                    }, [])
                    .join('\n')
                : resume.personal.fullName}
        </h1>

        <div className="mt-5 text-[24px] font-medium tracking-[0.04em] text-[#313641]">
            {resume.personal.title}
        </div>
    </section>
);

const RightSummarySection = ({ resume }: { resume: ResumeData }) => {
    if (!resume.professionalSummary?.trim()) return null;

    return (
        <section className="px-10 pb-2 pt-4">
            <h2 className="text-[26px] font-bold text-[#1d2129]">Professional Summary</h2>
            <div className="mt-4 text-[15px] leading-8 text-[#4b5563]">
                {resume.professionalSummary}
            </div>
        </section>
    );
};

const RightExperienceSection = ({ resume }: { resume: ResumeData }) => {
    const items = getVisibleExperience(resume);
    if (!items.length) return null;

    return (
        <section className="px-10 pb-2 pt-4">
            <h2 className="text-[26px] font-bold text-[#1d2129]">Professional Experience</h2>

            <div className="mt-8 space-y-9">
                {items.map((item) => {
                    const bullets = item.bullets.filter((bullet) => bullet.trim().length > 0);

                    return (
                        <article key={item.id} className="grid grid-cols-[64px_18px_1fr] gap-5">
                            <div className="text-center">
                                <div className="text-[14px] font-bold uppercase tracking-[0.06em] text-[#2a2f37]">
                                    {item.start || ''}
                                </div>
                                <div className="my-1 text-[20px] font-bold leading-none text-[#2a2f37]">-</div>
                                <div className="text-[14px] font-bold uppercase tracking-[0.06em] text-[#2a2f37]">
                                    {item.end || ''}
                                </div>
                            </div>

                            <div className="flex justify-center">
                                <div className="h-full w-px bg-[#b9bcc2]" />
                            </div>

                            <div>
                                <div className="text-[17px] font-bold text-[#1f232b]">{item.role}</div>
                                <div className="mt-1 text-[14px] text-[#474d57]">
                                    {[item.company, item.location, item.project].filter(Boolean).join(' | ')}
                                </div>

                                {bullets.length > 0 ? (
                                    <ul className="mt-4 space-y-2 pl-5 text-[14px] leading-7 text-[#3f4650]">
                                        {bullets.map((bullet, index) => (
                                            <li key={`${item.id}-bullet-${index}`}>{bullet}</li>
                                        ))}
                                    </ul>
                                ) : null}
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
};

const RightReferencesSection = ({ resume }: { resume: ResumeData }) => {
    const items = getVisibleReferences(resume);
    if (!items.length) return null;

    return (
        <section className="px-10 pb-10 pt-4">
            <h2 className="text-[26px] font-bold text-[#1d2129]">References</h2>

            <div className="mt-8 grid grid-cols-2 gap-8">
                {items.slice(0, 2).map((item) => (
                    <div key={item.id}>
                        <div className="text-[18px] font-bold text-[#1f232b]">{item.name}</div>
                        <div className="mt-1 text-[16px] text-[#3f4650]">{item.company}</div>

                        <div className="mt-4 space-y-2 text-[14px] leading-6 text-[#4b5563]">
                            {item.phone ? (
                                <div>
                                    <span className="font-bold text-[#1f232b]">Phone:</span> {item.phone}
                                </div>
                            ) : null}

                            {item.email ? (
                                <div>
                                    <span className="font-bold text-[#1f232b]">Email:</span> {item.email}
                                </div>
                            ) : null}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

const createLeftSections = (resume: ResumeData): PageSection[] => {
    const sections: PageSection[] = [
        {
            key: 'profile',
            estimatedHeight: 230,
            content: <LeftProfileSection resume={resume} />
        }
    ];

    if (getVisibleContactRows(resume).length > 0) {
        sections.push({
            key: 'contact',
            estimatedHeight: 180,
            content: <LeftContactSection resume={resume} />
        });
    }

    if (getVisibleEducation(resume).length > 0) {
        sections.push({
            key: 'education',
            estimatedHeight: 150,
            content: <LeftEducationSection resume={resume} />
        });
    }

    if (getVisibleSkills(resume).length > 0) {
        sections.push({
            key: 'skills',
            estimatedHeight: 180,
            content: <LeftSkillsSection resume={resume} />
        });
    }

    if (getVisibleLanguages(resume).length > 0) {
        sections.push({
            key: 'languages',
            estimatedHeight: 130,
            content: <LeftLanguagesSection resume={resume} />
        });
    }

    return sections;
};

const createRightSections = (resume: ResumeData): PageSection[] => {
    const sections: PageSection[] = [
        {
            key: 'header',
            estimatedHeight: 180,
            content: <RightHeaderSection resume={resume} />
        }
    ];

    if (resume.professionalSummary?.trim()) {
        sections.push({
            key: 'summary',
            estimatedHeight: 130,
            content: <RightSummarySection resume={resume} />
        });
    }

    if (getVisibleExperience(resume).length > 0) {
        sections.push({
            key: 'experience',
            estimatedHeight: 420,
            content: <RightExperienceSection resume={resume} />
        });
    }

    if (getVisibleReferences(resume).length > 0) {
        sections.push({
            key: 'references',
            estimatedHeight: 150,
            content: <RightReferencesSection resume={resume} />
        });
    }

    return sections;
};

const paginateSections = (
    leftSections: PageSection[],
    rightSections: PageSection[]
): ResumePage[] => {
    const pages: ResumePage[] = [];

    let leftIndex = 0;
    let rightIndex = 0;

    while (leftIndex < leftSections.length || rightIndex < rightSections.length) {
        let leftUsed = 0;
        let rightUsed = 0;

        const currentLeft: PageSection[] = [];
        const currentRight: PageSection[] = [];

        while (leftIndex < leftSections.length) {
            const next = leftSections[leftIndex];
            if (currentLeft.length > 0 && leftUsed + next.estimatedHeight > USABLE_HEIGHT) break;
            currentLeft.push(next);
            leftUsed += next.estimatedHeight;
            leftIndex += 1;
        }

        while (rightIndex < rightSections.length) {
            const next = rightSections[rightIndex];
            if (currentRight.length > 0 && rightUsed + next.estimatedHeight > USABLE_HEIGHT) break;
            currentRight.push(next);
            rightUsed += next.estimatedHeight;
            rightIndex += 1;
        }

        if (currentLeft.length === 0 && leftIndex < leftSections.length) {
            currentLeft.push(leftSections[leftIndex]);
            leftIndex += 1;
        }

        if (currentRight.length === 0 && rightIndex < rightSections.length) {
            currentRight.push(rightSections[rightIndex]);
            rightIndex += 1;
        }

        pages.push({
            leftSections: currentLeft,
            rightSections: currentRight
        });
    }

    return pages;
};

export const buildMinimalClassicBlockPages = (resume: ResumeData): ResumePage[] => {
    const leftSections = createLeftSections(resume);
    const rightSections = createRightSections(resume);
    return paginateSections(leftSections, rightSections);
};

export const ResumeMinimalClassicBlock = ({ resume, pageIndex }: Props) => {
    const pages = buildMinimalClassicBlockPages(resume);
    const visiblePages =
        typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

    return (
        <>
            {visiblePages.map((page, index) => (
                <div
                    key={`resume-minimal-classic-block-${index}`}
                    data-pdf-page="true"
                    className={`${resumePaperClassName} rounded-none bg-[#f7f7f5]`}
                    style={{
                        ...resumePaperStyle,
                        width: '794px',
                        minHeight: '1123px',
                        fontSize: `${resume.editorSettings.baseFontSize}px`,
                        breakAfter: index === visiblePages.length - 1 ? 'auto' : 'page',
                        pageBreakAfter: index === visiblePages.length - 1 ? 'auto' : 'always'
                    }}
                >
                    <div
                        className="grid"
                        style={{
                            gridTemplateColumns: '34% 66%'
                        }}
                    >
                        <aside
                            className="min-h-full"
                            style={{
                                background: LEFT_BG,
                                paddingTop: `${PAGE_PADDING_Y}px`,
                                paddingBottom: `${PAGE_PADDING_Y}px`
                            }}
                        >
                            <div className="space-y-10">
                                {page.leftSections.map((section) => (
                                    <div key={section.key}>{section.content}</div>
                                ))}
                            </div>
                        </aside>

                        <main
                            className="min-h-full"
                            style={{
                                background: RIGHT_BG,
                                paddingTop: `${PAGE_PADDING_Y}px`,
                                paddingBottom: `${PAGE_PADDING_Y}px`
                            }}
                        >
                            <div className="space-y-4">
                                {page.rightSections.map((section) => (
                                    <div key={section.key}>{section.content}</div>
                                ))}
                            </div>
                        </main>
                    </div>
                </div>
            ))}
        </>
    );
};