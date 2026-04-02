import type { ReactNode } from 'react';
import { ResumeData } from '../../../types/resume';
import { ResumeLanguageListBlock } from '../blocks/ResumeLanguageListBlock';
import { ResumePhotoBlock } from '../blocks/ResumePhotoBlock';
import { ResumeSectionTitleBlock } from '../blocks/ResumeSectionTitleBlock';
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
} from './ResumeBlocks';
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
    headerSections: PageSection[];
    leftSections: PageSection[];
    rightSections: PageSection[];
    footerSections: PageSection[];
};

const PAGE_HEIGHT = 1123;
const DEFAULT_USABLE_HEIGHT = 1095;
const RELAXED_USABLE_HEIGHT = 1140;

const visibleSkills = (resume: ResumeData) =>
    resume.skills.filter((item) => (item.name ?? '').trim().length > 0 && (item.percent ?? 0) > 0);

const visibleLanguages = (resume: ResumeData) =>
    resume.languages.filter((item) =>
        Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
    );

const visibleQualities = (resume: ResumeData) =>
    resume.qualities.filter(
        (item) => (item.name ?? '').trim().length > 0 && (item.percent ?? 0) > 0
    );

const visibleEducation = (resume: ResumeData) =>
    resume.education.filter(
        (item) =>
            (item.school ?? '').trim().length > 0 ||
            (item.degree ?? '').trim().length > 0 ||
            (item.start ?? '').trim().length > 0 ||
            (item.end ?? '').trim().length > 0
    );

const visibleCourses = (resume: ResumeData) =>
    resume.courses.filter((item) =>
        Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
    );

const visibleCertificates = (resume: ResumeData) =>
    resume.certificates.filter((item) =>
        Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
    );

const visibleReferences = (resume: ResumeData) =>
    resume.references.filter((item) =>
        Object.values(item ?? {}).some((value) => String(value ?? '').trim().length > 0)
    );

const visibleAchievements = (resume: ResumeData) =>
    resume.achievements.filter(
        (item) => (item.title ?? '').trim().length > 0 || (item.description ?? '').trim().length > 0
    );

const visibleInternships = (resume: ResumeData) =>
    resume.internships.filter((item) =>
        Object.values(item ?? {}).some((value) => {
            if (Array.isArray(value)) {
                return value.some((entry) => String(entry ?? '').trim().length > 0);
            }
            return String(value ?? '').trim().length > 0;
        })
    );

const visibleExperience = (resume: ResumeData) =>
    resume.experience.filter(
        (item) =>
            (item.role ?? '').trim().length > 0 ||
            (item.company ?? '').trim().length > 0 ||
            (item.project ?? '').trim().length > 0 ||
            (item.location ?? '').trim().length > 0 ||
            item.bullets.some((bullet) => bullet.trim().length > 0)
    );

const createHeaderSections = (resume: ResumeData, accent: string): PageSection[] => [
    {
        key: 'header',
        estimatedHeight: 155,
        content: (
            <div
                className="p-10 text-white"
                style={{
                    background: `linear-gradient(135deg, ${accent} 0%, #4f46e5 100%)`
                }}
            >
                <div className="flex items-start gap-6">
                    <ResumePhotoBlock
                        photo={resume.personal.photo}
                        alt={resume.personal.fullName}
                        light
                        sizeClassName="h-24 w-24"
                        rounded="rounded-2xl"
                    />

                    <div className="flex-1">
                        <h1 className="text-[34px] font-bold leading-tight">{resume.personal.fullName}</h1>

                        {resume.personal.title ? (
                            <p className="mt-1 text-[18px] text-white/90">{resume.personal.title}</p>
                        ) : null}

                        {(resume.personal.email || resume.personal.phone) && (
                            <div className="mt-3 text-sm text-white/80">
                                {[resume.personal.email, resume.personal.phone].filter(Boolean).join(' • ')}
                            </div>
                        )}

                        {resume.personal.address ? (
                            <div className="mt-1 text-sm text-white/80">{resume.personal.address}</div>
                        ) : null}
                    </div>
                </div>
            </div>
        )
    }
];

const createLeftSections = (
    resume: ResumeData,
    accent: string,
    isPdf: boolean
): PageSection[] => {
    const sections: PageSection[] = [];
    const experience = visibleExperience(resume);
    const internships = visibleInternships(resume);
    const achievements = visibleAchievements(resume);

    sections.push({
        key: 'summary',
        estimatedHeight: resume.professionalSummary ? 95 : 18,
        content: <ResumeSummary resume={resume} accent={accent} />
    });

    if (experience.length > 0) {
        sections.push({
            key: 'experience',
            estimatedHeight:
                70 +
                experience.reduce((total, item) => {
                    const bulletCount = item.bullets.filter((bullet) => bullet.trim().length > 0).length;
                    return total + 72 + bulletCount * 18;
                }, 0),
            content: (
                <div className="mt-8">
                    <ResumeExperienceList resume={resume} accent={accent} isPdf={isPdf} />
                </div>
            )
        });
    }

    if (resume.enabledSections.internships && internships.length > 0) {
        sections.push({
            key: 'internships',
            estimatedHeight: 70 + internships.length * 78,
            content: (
                <div className="mt-8">
                    <ResumeInternshipsList resume={resume} accent={accent} />
                </div>
            )
        });
    }

    if (resume.enabledSections.achievements && achievements.length > 0) {
        sections.push({
            key: 'achievements',
            estimatedHeight: 70 + achievements.length * 52,
            content: (
                <div className="mt-8">
                    <ResumeAchievementsList resume={resume} accent={accent} />
                </div>
            )
        });
    }

    return sections;
};

const createRightSections = (
    resume: ResumeData,
    accent: string,
    isPdf: boolean
): PageSection[] => {
    const sections: PageSection[] = [];
    const skills = visibleSkills(resume);
    const education = visibleEducation(resume);
    const languages = visibleLanguages(resume);
    const qualities = visibleQualities(resume);
    const courses = visibleCourses(resume);
    const certificates = visibleCertificates(resume);
    const references = visibleReferences(resume);

    if (skills.length > 0) {
        sections.push({
            key: 'skills',
            estimatedHeight: 80 + Math.ceil(skills.length / 2) * 40,
            content: (
                <>
                    <ResumeSectionTitleBlock accent={accent}>Skills</ResumeSectionTitleBlock>
                    <ResumeSkillGrid skills={skills} accent={accent} isPdf={isPdf} />
                </>
            )
        });
    }

    if (education.length > 0) {
        sections.push({
            key: 'education',
            estimatedHeight: 90 + education.length * 64,
            content: (
                <div className={sections.length > 0 ? 'mt-8' : ''}>
                    <ResumeEducationList resume={resume} accent={accent} />
                </div>
            )
        });
    }

    if (languages.length > 0) {
        sections.push({
            key: 'languages',
            estimatedHeight: 55 + languages.length * 36,
            content: (
                <div className={sections.length > 0 ? 'mt-8' : ''}>
                    <ResumeSectionTitleBlock accent={accent}>Languages</ResumeSectionTitleBlock>
                    <ResumeLanguageListBlock resume={resume} />
                </div>
            )
        });
    }

    if (resume.enabledSections.qualities && qualities.length > 0) {
        sections.push({
            key: 'qualities',
            estimatedHeight: 55 + qualities.length * 36,
            content: (
                <div className={sections.length > 0 ? 'mt-8' : ''}>
                    <ResumeDotPercentageRatings
                        items={qualities}
                        accent={accent}
                        variant="outline"
                    />
                </div>
            )
        });
    }

    if (resume.enabledSections.courses && courses.length > 0) {
        sections.push({
            key: 'courses',
            estimatedHeight: 70 + courses.length * 52,
            content: (
                <div className={sections.length > 0 ? 'mt-8' : ''}>
                    <ResumeCoursesList resume={resume} accent={accent} />
                </div>
            )
        });
    }

    if (resume.enabledSections.certificates && certificates.length > 0) {
        sections.push({
            key: 'certificates',
            estimatedHeight: 70 + certificates.length * 52,
            content: (
                <div className={sections.length > 0 ? 'mt-8' : ''}>
                    <ResumeCertificatesList resume={resume} accent={accent} />
                </div>
            )
        });
    }

    if (resume.enabledSections.references && references.length > 0) {
        sections.push({
            key: 'references',
            estimatedHeight: 60 + references.length * 52,
            content: (
                <div className={sections.length > 0 ? 'mt-8' : ''}>
                    <ResumeReferencesList resume={resume} accent={accent} />
                </div>
            )
        });
    }

    return sections;
};

const createFooterSections = (resume: ResumeData, accent: string): PageSection[] => {
    if (!(resume.enabledSections.footer && resume.footer)) {
        return [];
    }

    return [
        {
            key: 'footer',
            estimatedHeight: 75,
            content: (
                <div className="px-10 pb-10">
                    <ResumeFooterText title="Footer" value={resume.footer} accent={accent} />
                </div>
            )
        }
    ];
};

const paginateSections = (
    headerSections: PageSection[],
    leftSections: PageSection[],
    rightSections: PageSection[],
    footerSections: PageSection[],
    usableHeight: number
): ResumePage[] => {
    const pages: ResumePage[] = [];

    let headerIndex = 0;
    let leftIndex = 0;
    let rightIndex = 0;
    let footerIndex = 0;

    while (
        headerIndex < headerSections.length ||
        leftIndex < leftSections.length ||
        rightIndex < rightSections.length ||
        footerIndex < footerSections.length
    ) {
        let usedHeight = 0;
        const pageHeader: PageSection[] = [];
        const pageLeft: PageSection[] = [];
        const pageRight: PageSection[] = [];
        const pageFooter: PageSection[] = [];

        while (headerIndex < headerSections.length) {
            const section = headerSections[headerIndex];
            const nextHeight = usedHeight + section.estimatedHeight;
            if (pageHeader.length > 0 && nextHeight > usableHeight) break;
            pageHeader.push(section);
            usedHeight = nextHeight;
            headerIndex += 1;
        }

        const remainingForGridAndFooter = Math.max(usableHeight - usedHeight, 0);

        let leftUsed = 0;
        let rightUsed = 0;

        while (leftIndex < leftSections.length) {
            const section = leftSections[leftIndex];
            const nextHeight = leftUsed + section.estimatedHeight;
            if (pageLeft.length > 0 && nextHeight > remainingForGridAndFooter) break;
            pageLeft.push(section);
            leftUsed = nextHeight;
            leftIndex += 1;
        }

        while (rightIndex < rightSections.length) {
            const section = rightSections[rightIndex];
            const nextHeight = rightUsed + section.estimatedHeight;
            if (pageRight.length > 0 && nextHeight > remainingForGridAndFooter) break;
            pageRight.push(section);
            rightUsed = nextHeight;
            rightIndex += 1;
        }

        const gridHeight =
            pageLeft.length > 0 || pageRight.length > 0 ? Math.max(leftUsed, rightUsed) + 32 : 0;

        usedHeight += gridHeight;

        while (footerIndex < footerSections.length) {
            const section = footerSections[footerIndex];
            const nextHeight = usedHeight + section.estimatedHeight;
            if (pageFooter.length > 0 && nextHeight > usableHeight) break;
            if (
                pageFooter.length === 0 &&
                (pageHeader.length > 0 || pageLeft.length > 0 || pageRight.length > 0) &&
                nextHeight > usableHeight
            ) {
                break;
            }
            pageFooter.push(section);
            usedHeight = nextHeight;
            footerIndex += 1;
        }

        if (pageHeader.length === 0 && headerIndex < headerSections.length) {
            pageHeader.push(headerSections[headerIndex]);
            headerIndex += 1;
        }

        if (pageLeft.length === 0 && leftIndex < leftSections.length && pageRight.length === 0) {
            pageLeft.push(leftSections[leftIndex]);
            leftIndex += 1;
        }

        if (pageRight.length === 0 && rightIndex < rightSections.length && pageLeft.length === 0) {
            pageRight.push(rightSections[rightIndex]);
            rightIndex += 1;
        }

        if (pageFooter.length === 0 && footerIndex < footerSections.length) {
            pageFooter.push(footerSections[footerIndex]);
            footerIndex += 1;
        }

        if (
            pageHeader.length > 0 ||
            pageLeft.length > 0 ||
            pageRight.length > 0 ||
            pageFooter.length > 0
        ) {
            pages.push({
                headerSections: pageHeader,
                leftSections: pageLeft,
                rightSections: pageRight,
                footerSections: pageFooter
            });
        } else {
            break;
        }
    }

    return pages;
};

export const buildCreativeGradientPages = (
    resume: ResumeData,
    isPdf = false
): ResumePage[] => {
    const accent = resume.editorSettings.accentColor;
    const headerSections = createHeaderSections(resume, accent);
    const leftSections = createLeftSections(resume, accent, isPdf);
    const rightSections = createRightSections(resume, accent, isPdf);
    const footerSections = createFooterSections(resume, accent);

    const defaultPages = paginateSections(
        headerSections,
        leftSections,
        rightSections,
        footerSections,
        DEFAULT_USABLE_HEIGHT
    );

    if (defaultPages.length === 1) return defaultPages;

    return paginateSections(
        headerSections,
        leftSections,
        rightSections,
        footerSections,
        RELAXED_USABLE_HEIGHT
    );
};

export const ResumeCreativeGradient = ({
    resume,
    isPdf = false,
    pageIndex
}: Props) => {
    const pages = buildCreativeGradientPages(resume, isPdf);
    const visiblePages =
        typeof pageIndex === 'number' ? pages.filter((_, index) => index === pageIndex) : pages;

    return (
        <>
            {visiblePages.map((page, index) => (
                <div
                    key={`resume-creative-gradient-page-${index}`}
                    className={`${resumePaperClassName} rounded-none overflow-hidden`}
                    style={{
                        ...resumePaperStyle,
                        width: '794px',
                        minHeight: `${PAGE_HEIGHT}px`,
                        fontSize: `${resume.editorSettings.baseFontSize}px`,
                        breakAfter: index === visiblePages.length - 1 ? 'auto' : 'page',
                        pageBreakAfter: index === visiblePages.length - 1 ? 'auto' : 'always'
                    }}
                >
                    {page.headerSections.map((section) => (
                        <div key={section.key}>{section.content}</div>
                    ))}

                    {(page.leftSections.length > 0 || page.rightSections.length > 0) && (
                        <div className="grid grid-cols-[1.1fr_0.9fr] items-start gap-8 p-10 text-slate-800">
                            <div>
                                {page.leftSections.map((section) => (
                                    <div key={section.key}>{section.content}</div>
                                ))}
                            </div>

                            <div>
                                {page.rightSections.map((section) => (
                                    <div key={section.key}>{section.content}</div>
                                ))}
                            </div>
                        </div>
                    )}

                    {page.footerSections.map((section) => (
                        <div key={section.key}>{section.content}</div>
                    ))}
                </div>
            ))}
        </>
    );
};