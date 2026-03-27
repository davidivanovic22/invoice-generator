import type {
  ResumeData,
  ResumeEducationItem,
  ResumeExperienceItem,
  ResumeLanguageItem,
  ResumePersonalInfo,
  ResumesState
} from '../types/resume';
import {
  createResume,
  createResumeEducationItem,
  createResumeEditorSettings,
  createResumeExperienceItem,
  createResumeLanguageItem,
  createResumePersonalInfo
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
          bullets: Array.isArray(item?.bullets) ? item.bullets : []
        })
      )
    : [];

const normalizeEducation = (
  items?: Partial<ResumeEducationItem>[]
): ResumeEducationItem[] =>
  Array.isArray(items)
    ? items.map((item) => createResumeEducationItem(item))
    : [];

const normalizeLanguages = (
  items?: Partial<ResumeLanguageItem>[]
): ResumeLanguageItem[] =>
  Array.isArray(items)
    ? items.map((item) => createResumeLanguageItem(item))
    : [];

export const normalizeResume = (resume?: Partial<ResumeData>): ResumeData => {
  const fallback = createResume();
  const safeResume: Partial<ResumeData> = resume ?? {};

  return {
    id: safeResume.id ?? fallback.id,
    personal: normalizePersonal(safeResume.personal),
    professionalSummary:
      safeResume.professionalSummary ?? fallback.professionalSummary,
    skills: Array.isArray(safeResume.skills)
      ? safeResume.skills
      : fallback.skills,
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

    if (!Array.isArray(parsed.resumes)) {
      return null;
    }

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