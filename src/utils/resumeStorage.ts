import type {
    ResumeAchievementItem,
    ResumeCertificateItem,
    ResumeCourseItem,
    ResumeCustomSection,
    ResumeData,
    ResumeEducationItem,
    ResumeExperienceItem,
    ResumeInternshipItem,
    ResumeLanguageItem,
    ResumePersonalInfo,
    ResumeReferenceItem,
    ResumesState
} from '../types/resume';
import {
    createResume,
    createResumeAchievementItem,
    createResumeCertificateItem,
    createResumeCourseItem,
    createResumeCustomSection,
    createResumeEditorSettings,
    createResumeEducationItem,
    createResumeEnabledPersonalFields,
    createResumeEnabledSections,
    createResumeExperienceItem,
    createResumeInternshipItem,
    createResumeLanguageItem,
    createResumePersonalInfo,
    createResumeReferenceItem
} from './resume';

const STORAGE_KEY = 'resume-builder';

const normalizePersonal = (
    personal?: Partial<ResumePersonalInfo>
): ResumePersonalInfo => createResumePersonalInfo(personal);

const normalizeExperience = (
    items?: Partial<ResumeExperienceItem>[]
): ResumeExperienceItem[] =>
    Array.isArray(items)
        ? items.map((item) =>
            createResumeExperienceItem({
                ...item,
                bullets: Array.isArray(item?.bullets) ? item.bullets.filter(Boolean) : []
            })
        )
        : [];

const normalizeEducation = (
    items?: Partial<ResumeEducationItem>[]
): ResumeEducationItem[] =>
    Array.isArray(items) ? items.map((item) => createResumeEducationItem(item)) : [];

const normalizeLanguages = (
    items?: Partial<ResumeLanguageItem>[]
): ResumeLanguageItem[] =>
    Array.isArray(items) ? items.map((item) => createResumeLanguageItem(item)) : [];

const normalizeCourses = (
    items?: Partial<ResumeCourseItem>[]
): ResumeCourseItem[] =>
    Array.isArray(items) ? items.map((item) => createResumeCourseItem(item)) : [];

const normalizeInternships = (
    items?: Partial<ResumeInternshipItem>[]
): ResumeInternshipItem[] =>
    Array.isArray(items) ? items.map((item) => createResumeInternshipItem(item)) : [];

const normalizeReferences = (
    items?: Partial<ResumeReferenceItem>[]
): ResumeReferenceItem[] =>
    Array.isArray(items) ? items.map((item) => createResumeReferenceItem(item)) : [];

const normalizeCertificates = (
    items?: Partial<ResumeCertificateItem>[]
): ResumeCertificateItem[] =>
    Array.isArray(items) ? items.map((item) => createResumeCertificateItem(item)) : [];

const normalizeAchievements = (
    items?: Partial<ResumeAchievementItem>[]
): ResumeAchievementItem[] =>
    Array.isArray(items) ? items.map((item) => createResumeAchievementItem(item)) : [];

const normalizeCustomSections = (
    items?: Partial<ResumeCustomSection>[]
): ResumeCustomSection[] =>
    Array.isArray(items)
        ? items.map((item) =>
            createResumeCustomSection({
                ...item,
                items: Array.isArray(item?.items) ? item.items : []
            })
        )
        : [];

export const normalizeResume = (resume?: Partial<ResumeData>): ResumeData => {
    const fallback = createResume();
    const safeResume = resume ?? {};

    return {
        id: safeResume.id ?? fallback.id,
        personal: normalizePersonal(safeResume.personal),
        professionalSummary:
            safeResume.professionalSummary ?? fallback.professionalSummary,
        skills: Array.isArray(safeResume.skills) ? safeResume.skills : fallback.skills,
        hobbies: Array.isArray(safeResume.hobbies) ? safeResume.hobbies : fallback.hobbies,
        qualities: Array.isArray(safeResume.qualities)
            ? safeResume.qualities
            : fallback.qualities,
        courses: normalizeCourses(safeResume.courses),
        internships: normalizeInternships(safeResume.internships),
        extracurricularActivities: Array.isArray(safeResume.extracurricularActivities)
            ? safeResume.extracurricularActivities
            : fallback.extracurricularActivities,
        references: normalizeReferences(safeResume.references),
        certificates: normalizeCertificates(safeResume.certificates),
        achievements: normalizeAchievements(safeResume.achievements),
        customSections: normalizeCustomSections(safeResume.customSections),
        footer: safeResume.footer ?? fallback.footer,
        signature: safeResume.signature ?? fallback.signature,
        enabledPersonalFields:
            safeResume.enabledPersonalFields ?? createResumeEnabledPersonalFields(),
        enabledSections:
            safeResume.enabledSections ?? createResumeEnabledSections(),
        experience: normalizeExperience(safeResume.experience),
        education: normalizeEducation(safeResume.education),
        languages: normalizeLanguages(safeResume.languages),
        editorSettings: createResumeEditorSettings(safeResume.editorSettings),
        createdAt: safeResume.createdAt ?? fallback.createdAt,
        updatedAt: safeResume.updatedAt ?? new Date().toISOString()
    };
};

export const loadResumesState = (): ResumesState | null => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Partial<ResumesState>;
        if (!Array.isArray(parsed.resumes)) return null;

        const resumes = parsed.resumes.map((resume) => normalizeResume(resume));
        const activeResumeId =
            parsed.activeResumeId &&
                resumes.some((resume) => resume.id === parsed.activeResumeId)
                ? parsed.activeResumeId
                : resumes[0]?.id ?? null;

        return {
            resumes,
            activeResumeId
        };
    } catch {
        return null;
    }
};

export const saveResumesState = (state: ResumesState): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const clearResumesState = (): void => {
    localStorage.removeItem(STORAGE_KEY);
};