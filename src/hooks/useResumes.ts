import { useEffect, useMemo, useState } from 'react';
import type {
  ResumeData,
  ResumeEducationItem,
  ResumeExperienceItem,
  ResumeLanguageItem,
  ResumePersonalInfo,
  ResumesState
} from '../types/resume';
import { createResume } from '../utils/resume';
import {
  clearResumesState,
  loadResumesState,
  normalizeResume,
  saveResumesState
} from '../utils/resumeStorage';

const createInitialState = (): ResumesState => {
  const loaded = loadResumesState();
  if (loaded) return loaded;

  const initial = createResume();
  return {
    resumes: [initial],
    activeResumeId: initial.id
  };
};

export const useResumes = () => {
  const [state, setState] = useState<ResumesState>(createInitialState);

  useEffect(() => {
    saveResumesState(state);
  }, [state]);

  const activeResume = useMemo(
    () => state.resumes.find((resume) => resume.id === state.activeResumeId) ?? null,
    [state]
  );

  const createNewResume = () => {
    const resume = createResume();

    setState((prev) => ({
      resumes: [resume, ...prev.resumes],
      activeResumeId: resume.id
    }));
  };

  const duplicateActiveResume = () => {
    if (!activeResume) return;

    const copy = normalizeResume({
      ...activeResume,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    setState((prev) => ({
      resumes: [copy, ...prev.resumes],
      activeResumeId: copy.id
    }));
  };

  const deleteActiveResume = () => {
    if (!activeResume) return;

    setState((prev) => {
      const resumes = prev.resumes.filter((resume) => resume.id !== activeResume.id);
      return {
        resumes,
        activeResumeId: resumes[0]?.id ?? null
      };
    });
  };

  const resetActiveResume = () => {
    if (!activeResume) return;

    const fresh = createResume();

    setState((prev) => ({
      ...prev,
      resumes: prev.resumes.map((resume) =>
        resume.id === activeResume.id
          ? {
              ...fresh,
              id: activeResume.id,
              createdAt: activeResume.createdAt
            }
          : resume
      )
    }));
  };

  const selectResume = (resumeId: string) => {
    setState((prev) => ({
      ...prev,
      activeResumeId: resumeId
    }));
  };

  const updateResume = (patch: Partial<ResumeData>) => {
    if (!activeResume) return;

    setState((prev) => ({
      ...prev,
      resumes: prev.resumes.map((resume) =>
        resume.id === activeResume.id
          ? {
              ...resume,
              ...patch,
              updatedAt: new Date().toISOString()
            }
          : resume
      )
    }));
  };

  const updatePersonalField = <K extends keyof ResumePersonalInfo>(
    field: K,
    value: ResumePersonalInfo[K]
  ) => {
    if (!activeResume) return;

    updateResume({
      personal: {
        ...activeResume.personal,
        [field]: value
      }
    });
  };

  const updateExperienceItem = (
    itemId: string,
    patch: Partial<ResumeExperienceItem>
  ) => {
    if (!activeResume) return;

    updateResume({
      experience: activeResume.experience.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      )
    });
  };

  const addExperienceItem = () => {
    if (!activeResume) return;

    updateResume({
      experience: [
        ...activeResume.experience,
        {
          id: crypto.randomUUID(),
          company: '',
          project: '',
          location: '',
          role: '',
          start: '',
          end: '',
          bullets: ['']
        }
      ]
    });
  };

  const removeExperienceItem = (itemId: string) => {
    if (!activeResume) return;

    updateResume({
      experience: activeResume.experience.filter((item) => item.id !== itemId)
    });
  };

  const updateEducationItem = (
    itemId: string,
    patch: Partial<ResumeEducationItem>
  ) => {
    if (!activeResume) return;

    updateResume({
      education: activeResume.education.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      )
    });
  };

  const addEducationItem = () => {
    if (!activeResume) return;

    updateResume({
      education: [
        ...activeResume.education,
        {
          id: crypto.randomUUID(),
          school: '',
          degree: '',
          start: '',
          end: ''
        }
      ]
    });
  };

  const removeEducationItem = (itemId: string) => {
    if (!activeResume) return;

    updateResume({
      education: activeResume.education.filter((item) => item.id !== itemId)
    });
  };

  const updateLanguageItem = (
    itemId: string,
    patch: Partial<ResumeLanguageItem>
  ) => {
    if (!activeResume) return;

    updateResume({
      languages: activeResume.languages.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      )
    });
  };

  const addLanguageItem = () => {
    if (!activeResume) return;

    updateResume({
      languages: [
        ...activeResume.languages,
        {
          id: crypto.randomUUID(),
          name: '',
          level: ''
        }
      ]
    });
  };

  const removeLanguageItem = (itemId: string) => {
    if (!activeResume) return;

    updateResume({
      languages: activeResume.languages.filter((item) => item.id !== itemId)
    });
  };

  const exportCurrentResume = () => {
    if (!activeResume) return;

    const blob = new Blob([JSON.stringify(activeResume, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `resume-${activeResume.personal.fullName || 'document'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportAllResumes = () => {
    const blob = new Blob([JSON.stringify(state.resumes, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'resumes.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importFromJson = async (file: File) => {
    const raw = await file.text();
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      const resumes = parsed.map((item) => normalizeResume(item));
      setState({
        resumes,
        activeResumeId: resumes[0]?.id ?? null
      });
      return;
    }

    const resume = normalizeResume(parsed);
    setState((prev) => ({
      resumes: [resume, ...prev.resumes],
      activeResumeId: resume.id
    }));
  };

  const clearAllResumes = () => {
    clearResumesState();
    const fresh = createResume();
    setState({
      resumes: [fresh],
      activeResumeId: fresh.id
    });
  };

  return {
    state,
    activeResume,
    createNewResume,
    duplicateActiveResume,
    deleteActiveResume,
    resetActiveResume,
    selectResume,
    updateResume,
    updatePersonalField,
    updateExperienceItem,
    addExperienceItem,
    removeExperienceItem,
    updateEducationItem,
    addEducationItem,
    removeEducationItem,
    updateLanguageItem,
    addLanguageItem,
    removeLanguageItem,
    exportCurrentResume,
    exportAllResumes,
    importFromJson,
    clearAllResumes
  };
};