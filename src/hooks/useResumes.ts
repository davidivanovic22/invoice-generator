import { useEffect, useMemo, useState } from 'react';
import type {
    ResumeAchievementItem,
    ResumeCertificateItem,
    ResumeCourseItem,
    ResumeCustomSection,
    ResumeCustomSectionKey,
    ResumeData,
    ResumeEducationItem,
    ResumeExperienceItem,
    ResumeInternshipItem,
    ResumeLanguageItem,
    ResumePersonalExtraFieldKey,
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
    createResumeEducationItem,
    createResumeExperienceItem,
    createResumeInternshipItem,
    createResumeLanguageItem,
    createResumeReferenceItem
} from '../utils/resume';
import {
    clearResumesState,
    loadResumesState,
    normalizeResume,
    saveResumesState
} from '../utils/resumeStorage';

type SimpleStringArrayField =
    | 'hobbies'
    | 'extracurricularActivities';

const createInitialState = (): ResumesState => {
    const loaded = loadResumesState();
    if (loaded) return loaded;

    const resume = createResume();

    return {
        resumes: [resume],
        activeResumeId: resume.id
    };
};

const downloadJson = (fileName: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
};

// const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const useResumes = () => {
    const [state, setState] = useState<ResumesState>(createInitialState);

    useEffect(() => {
        saveResumesState(state);
    }, [state]);

    const activeResume = useMemo(
        () =>
            state.resumes.find((resume) => resume.id === state.activeResumeId) ?? null,
        [state.resumes, state.activeResumeId]
    );

    const setActiveResume = (updater: (resume: ResumeData) => ResumeData) => {
        setState((prev) => {
            if (!prev.activeResumeId) return prev;

            return {
                ...prev,
                resumes: prev.resumes.map((resume) =>
                    resume.id === prev.activeResumeId
                        ? {
                            ...updater(resume),
                            updatedAt: new Date().toISOString()
                        }
                        : resume
                )
            };
        });
    };

    const createNewResume = () => {
        const resume = createResume();

        setState((prev) => ({
            resumes: [resume, ...prev.resumes],
            activeResumeId: resume.id
        }));
    };

    const duplicateActiveResume = () => {
        if (!activeResume) return;

        const duplicated = normalizeResume({
            ...activeResume,
            id: crypto.randomUUID(),
            personal: {
                ...activeResume.personal,
                fullName: activeResume.personal.fullName
                    ? `${activeResume.personal.fullName} Copy`
                    : 'Resume Copy'
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        setState((prev) => ({
            resumes: [duplicated, ...prev.resumes],
            activeResumeId: duplicated.id
        }));
    };

    const deleteActiveResume = () => {
        if (!activeResume) return;

        setState((prev) => {
            const resumes = prev.resumes.filter(
                (resume) => resume.id !== prev.activeResumeId
            );

            if (resumes.length === 0) {
                const resume = createResume();
                return {
                    resumes: [resume],
                    activeResumeId: resume.id
                };
            }

            return {
                resumes,
                activeResumeId: resumes[0].id
            };
        });
    };

    const resetActiveResume = () => {
        if (!activeResume) return;

        const freshResume = createResume();

        setState((prev) => ({
            ...prev,
            resumes: prev.resumes.map((resume) =>
                resume.id === prev.activeResumeId
                    ? {
                        ...freshResume,
                        id: resume.id,
                        createdAt: resume.createdAt,
                        updatedAt: new Date().toISOString()
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
        setActiveResume((resume) => ({
            ...resume,
            ...patch,
            personal: patch.personal
                ? { ...resume.personal, ...patch.personal }
                : resume.personal,
            editorSettings: patch.editorSettings
                ? { ...resume.editorSettings, ...patch.editorSettings }
                : resume.editorSettings,
            enabledPersonalFields: patch.enabledPersonalFields
                ? { ...resume.enabledPersonalFields, ...patch.enabledPersonalFields }
                : resume.enabledPersonalFields,
            enabledSections: patch.enabledSections
                ? { ...resume.enabledSections, ...patch.enabledSections }
                : resume.enabledSections
        }));
    };

    const updatePersonalField = <K extends keyof ResumePersonalInfo>(
        field: K,
        value: ResumePersonalInfo[K]
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            personal: {
                ...resume.personal,
                [field]: value
            }
        }));
    };

    const updateExperienceItem = (
        itemId: string,
        patch: Partial<ResumeExperienceItem>
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            experience: resume.experience.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item
            )
        }));
    };

    const addExperienceItem = () => {
        setActiveResume((resume) => ({
            ...resume,
            experience: [...resume.experience, createResumeExperienceItem()]
        }));
    };

    const removeExperienceItem = (itemId: string) => {
        setActiveResume((resume) => ({
            ...resume,
            experience: resume.experience.filter((item) => item.id !== itemId)
        }));
    };

    const updateEducationItem = (
        itemId: string,
        patch: Partial<ResumeEducationItem>
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            education: resume.education.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item
            )
        }));
    };

    const addEducationItem = () => {
        setActiveResume((resume) => ({
            ...resume,
            education: [...resume.education, createResumeEducationItem()]
        }));
    };

    const removeEducationItem = (itemId: string) => {
        setActiveResume((resume) => ({
            ...resume,
            education: resume.education.filter((item) => item.id !== itemId)
        }));
    };

    const updateLanguageItem = (
        itemId: string,
        patch: Partial<ResumeLanguageItem>
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            languages: resume.languages.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item
            )
        }));
    };

    const addLanguageItem = () => {
        setActiveResume((resume) => ({
            ...resume,
            languages: [...resume.languages, createResumeLanguageItem()]
        }));
    };

    const removeLanguageItem = (itemId: string) => {
        setActiveResume((resume) => ({
            ...resume,
            languages: resume.languages.filter((item) => item.id !== itemId)
        }));
    };

    const updateSimpleStringArray = (
        field: SimpleStringArrayField,
        index: number,
        value: string
    ) => {
        setActiveResume((resume) => {
            const nextItems = [...resume[field]];
            nextItems[index] = value;

            return {
                ...resume,
                [field]: nextItems
            };
        });
    };

    const addSimpleStringArrayItem = (
        field: SimpleStringArrayField,
        value = ''
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            [field]: [...resume[field], value]
        }));
    };

    const removeSimpleStringArrayItem = (
        field: SimpleStringArrayField,
        index: number
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            [field]: resume[field].filter(
                (_item: string, currentIndex: number) => currentIndex !== index
            )
        }));
    };

    const clampPercent = (value: number) =>
        Math.max(0, Math.min(100, Math.round(value)));

    const updateSkillItem = (
        index: number,
        field: 'name' | 'percent',
        value: string | number
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            skills: resume.skills.map((item, currentIndex) =>
                currentIndex === index
                    ? {
                        ...item,
                        [field]:
                            field === 'percent'
                                ? clampPercent(Number(value))
                                : String(value)
                    }
                    : item
            )
        }));
    };

    const addSkillItem = () => {
        setActiveResume((resume) => ({
            ...resume,
            skills: [
                ...resume.skills,
                {
                    id: crypto.randomUUID(),
                    name: '',
                    percent: 0
                }
            ]
        }));
    };

    const addQualityItem = () => {
        setActiveResume((resume) => ({
            ...resume,
            qualities: [
                ...resume.qualities,
                {
                    id: crypto.randomUUID(),
                    name: '',
                    percent: 0
                }
            ]
        }));
    };

    const updateQualityItem = (
        index: number,
        field: 'name' | 'percent',
        value: string | number
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            qualities: resume.qualities.map((item, currentIndex) =>
                currentIndex === index
                    ? {
                        ...item,
                        [field]:
                            field === 'percent'
                                ? clampPercent(Number(value))
                                : String(value)
                    }
                    : item
            )
        }));
    };

    const removeQualityItem = (index: number) => {
        setActiveResume((resume) => ({
            ...resume,
            qualities: resume.qualities.filter((_, currentIndex) => currentIndex !== index)
        }));
    };


    const removeSkillItem = (index: number) => {
        setActiveResume((resume) => ({
            ...resume,
            skills: resume.skills.filter((_, currentIndex) => currentIndex !== index)
        }));
    };

    const updateCourseItem = (
        itemId: string,
        patch: Partial<ResumeCourseItem>
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            courses: resume.courses.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item
            )
        }));
    };

    const addCourseItem = () => {
        setActiveResume((resume) => ({
            ...resume,
            courses: [...resume.courses, createResumeCourseItem()]
        }));
    };

    const removeCourseItem = (itemId: string) => {
        setActiveResume((resume) => ({
            ...resume,
            courses: resume.courses.filter((item) => item.id !== itemId)
        }));
    };

    const updateInternshipItem = (
        itemId: string,
        patch: Partial<ResumeInternshipItem>
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            internships: resume.internships.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item
            )
        }));
    };

    const addInternshipItem = () => {
        setActiveResume((resume) => ({
            ...resume,
            internships: [...resume.internships, createResumeInternshipItem()]
        }));
    };

    const removeInternshipItem = (itemId: string) => {
        setActiveResume((resume) => ({
            ...resume,
            internships: resume.internships.filter((item) => item.id !== itemId)
        }));
    };

    const updateReferenceItem = (
        itemId: string,
        patch: Partial<ResumeReferenceItem>
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            references: resume.references.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item
            )
        }));
    };

    const addReferenceItem = () => {
        setActiveResume((resume) => ({
            ...resume,
            references: [...resume.references, createResumeReferenceItem()]
        }));
    };

    const removeReferenceItem = (itemId: string) => {
        setActiveResume((resume) => ({
            ...resume,
            references: resume.references.filter((item) => item.id !== itemId)
        }));
    };

    const updateCertificateItem = (
        itemId: string,
        patch: Partial<ResumeCertificateItem>
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            certificates: resume.certificates.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item
            )
        }));
    };

    const addCertificateItem = () => {
        setActiveResume((resume) => ({
            ...resume,
            certificates: [...resume.certificates, createResumeCertificateItem()]
        }));
    };

    const removeCertificateItem = (itemId: string) => {
        setActiveResume((resume) => ({
            ...resume,
            certificates: resume.certificates.filter((item) => item.id !== itemId)
        }));
    };

    const updateAchievementItem = (
        itemId: string,
        patch: Partial<ResumeAchievementItem>
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            achievements: resume.achievements.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item
            )
        }));
    };

    const addAchievementItem = () => {
        setActiveResume((resume) => ({
            ...resume,
            achievements: [...resume.achievements, createResumeAchievementItem()]
        }));
    };

    const removeAchievementItem = (itemId: string) => {
        setActiveResume((resume) => ({
            ...resume,
            achievements: resume.achievements.filter((item) => item.id !== itemId)
        }));
    };

    const updateCustomSection = (
        sectionId: string,
        patch: Partial<ResumeCustomSection>
    ) => {
        setActiveResume((resume) => ({
            ...resume,
            customSections: resume.customSections.map((section) =>
                section.id === sectionId ? { ...section, ...patch } : section
            )
        }));
    };

    const addCustomSection = (title = 'Custom section') => {
        setActiveResume((resume) => ({
            ...resume,
            customSections: [
                ...resume.customSections,
                createResumeCustomSection({ title })
            ]
        }));
    };

    const removeCustomSection = (sectionId: string) => {
        setActiveResume((resume) => ({
            ...resume,
            customSections: resume.customSections.filter(
                (section) => section.id !== sectionId
            )
        }));
    };

    const enablePersonalField = (field: ResumePersonalExtraFieldKey) => {
        if (!activeResume) return;

        updateResume({
            enabledPersonalFields: {
                ...activeResume.enabledPersonalFields,
                [field]: true
            }
        });
    };

    const enableSection = (section: ResumeCustomSectionKey) => {
        if (!activeResume) return;

        updateResume({
            enabledSections: {
                ...activeResume.enabledSections,
                [section]: true
            }
        });
    };

    const exportCurrentResume = () => {
        if (!activeResume) return;

        downloadJson(
            `${activeResume.personal.fullName || 'resume'}.json`,
            activeResume
        );
    };

    const exportAllResumes = () => {
        downloadJson('resumes.json', state);
    };

    const importFromJson = async (file: File) => {
        const text = await file.text();
        const parsed = JSON.parse(text) as Partial<ResumesState> | Partial<ResumeData>;

        if ('resumes' in parsed && Array.isArray(parsed.resumes)) {
            const resumes = parsed.resumes.map((resume) => normalizeResume(resume));

            setState({
                resumes,
                activeResumeId: resumes[0]?.id ?? null
            });
            return;
        }

        const importedResume = normalizeResume(parsed as Partial<ResumeData>);
        setState((prev) => ({
            resumes: [importedResume, ...prev.resumes],
            activeResumeId: importedResume.id
        }));
    };

    const clearAllResumes = () => {
        clearResumesState();

        const resume = createResume();
        setState({
            resumes: [resume],
            activeResumeId: resume.id
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
        updateSimpleStringArray,
        addSimpleStringArrayItem,
        removeSimpleStringArrayItem,
        updateSkillItem,
        addSkillItem,
        removeSkillItem,
        addQualityItem,
        updateQualityItem,
        removeQualityItem,
        updateCourseItem,
        addCourseItem,
        removeCourseItem,
        updateInternshipItem,
        addInternshipItem,
        removeInternshipItem,
        updateReferenceItem,
        addReferenceItem,
        removeReferenceItem,
        updateCertificateItem,
        addCertificateItem,
        removeCertificateItem,
        updateAchievementItem,
        addAchievementItem,
        removeAchievementItem,
        updateCustomSection,
        addCustomSection,
        removeCustomSection,
        enablePersonalField,
        enableSection,
        exportCurrentResume,
        exportAllResumes,
        importFromJson,
        clearAllResumes
    };
};