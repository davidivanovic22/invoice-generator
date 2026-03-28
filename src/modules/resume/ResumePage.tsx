import { useRef, useState } from 'react';
import { useResumes } from '../../hooks/useResumes';
import { downloadDocumentPdf, previewDocumentPdf } from '../../utils/pdf';
import { ResumeEditorPreview } from '../../components/resume/ResumeEditorPreview';
import { ResumePrintPreview } from '../../components/resume/ResumePrintPreview';
import { ResumeThemeRail } from '../../components/resume/ResumeThemeRail';
import { ResumePersonalSection } from '../../components/resume/editors/ResumePersonalSection';
import { ResumeAdditionalSectionsPanel } from '../../components/resume/editors/ResumeAdditionalSectionsPanel';
import { ResumeStringListEditor } from '../../components/resume/editors/ResumeStringListEditor';
import { ResumePercentageListEditor } from '../../components/resume/editors/ResumePercentageListEditor';
import { ResumeCoursesEditor } from '../../components/resume/editors/ResumeCoursesEditor';
import { ResumeInternshipsEditor } from '../../components/resume/editors/ResumeInternshipsEditor';
import { ResumeReferencesEditor } from '../../components/resume/editors/ResumeReferencesEditor';
import { ResumeCertificatesEditor } from '../../components/resume/editors/ResumeCertificatesEditor';
import { ResumeAchievementsEditor } from '../../components/resume/editors/ResumeAchievementsEditor';
import { ResumeTextAreaSection } from '../../components/resume/editors/ResumeTextAreaSection';
import { ResumeExperienceEditor } from '../../components/resume/editors/ResumeExperienceEditor';
import { ResumeEducationEditor } from '../../components/resume/editors/ResumeEducationEditor';
import { AccordionSection } from '../../components/common/AcordionSection';
import { ActionPanel } from '../../components/sidebar/ActionPanel';
import { ImportExportPanel } from '../../components/sidebar/ImportExportPanel';

export const ResumePage = () => {
    const {
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
        updateSkillItem,
        addSkillItem,
        addQualityItem,
        updateQualityItem,
        removeQualityItem,
        removeSkillItem,
        exportCurrentResume,
        exportAllResumes,
        importFromJson,
        enablePersonalField,
        enableSection,
        updateSimpleStringArray,
        addSimpleStringArrayItem,
        removeSimpleStringArrayItem,
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
        removeAchievementItem
    } = useResumes();

    const printPreviewRef = useRef<HTMLDivElement | null>(null);
    const fileReaderRef = useRef<FileReader | null>(null);

    const [openSection, setOpenSection] = useState<string>('personal');

    const handleToggleSection = (sectionId: string) => {
        setOpenSection((current) => (current === sectionId ? '' : sectionId));
    };

    if (!activeResume) {
        return (
            <div className="grid min-h-full place-items-center p-6">
                <div className="rounded-2xl bg-white p-6 shadow-soft">
                    Unable to load resume.
                </div>
            </div>
        );
    }

    const handleImport = async (file: File) => {
        try {
            await importFromJson(file);
        } catch {
            alert('Invalid JSON file.');
        }
    };

    const handlePhotoUpload = (file: File) => {
        const reader = new FileReader();
        fileReaderRef.current = reader;

        reader.onload = () => {
            if (typeof reader.result === 'string') {
                updatePersonalField('photo', reader.result);
            }
        };

        reader.readAsDataURL(file);
    };

    const handlePreviewPdf = async () => {
        if (!printPreviewRef.current) return;

        try {
            await previewDocumentPdf({
                element: printPreviewRef.current
            });
        } catch (error) {
            console.error('PDF preview failed:', error);
            alert('Failed to preview PDF.');
        }
    };

    const handleDownloadPdf = async () => {
        if (!printPreviewRef.current) return;

        try {
            await downloadDocumentPdf({
                element: printPreviewRef.current,
                fileName: `resume-${activeResume.personal.fullName || 'document'}.pdf`
            });
        } catch (error) {
            console.error('PDF download failed:', error);
            alert('Failed to generate PDF.');
        }
    };

    return (
        <div className="flex w-full min-w-0 gap-6">
            <div className="w-[340px] shrink-0 overflow-y-auto pr-2">
                <div className="space-y-4">
                    <div>
                        <h1 className="text-[38px] font-black tracking-tight text-slate-900">
                            Resume Builder
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Build, preview, and export your CV.
                        </p>
                    </div>

                    <ActionPanel
                        onCreate={createNewResume}
                        onDuplicate={duplicateActiveResume}
                        onDelete={deleteActiveResume}
                        onPreviewPdf={handlePreviewPdf}
                        onDownloadPdf={handleDownloadPdf}
                    />

                    <ImportExportPanel
                        onExportCurrent={exportCurrentResume}
                        onExportAll={exportAllResumes}
                        onResetCurrent={resetActiveResume}
                        onImport={handleImport}
                    />

                    <AccordionSection
                        id="resume-list"
                        title="Resume list"
                        isOpen={openSection === 'resume-list'}
                        onToggle={handleToggleSection}
                        badge={
                            state.resumes.length ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                    {state.resumes.length}
                                </span>
                            ) : null
                        }
                    >
                        <div className="space-y-2">
                            {state.resumes.map((resume) => {
                                const isActive = resume.id === state.activeResumeId;

                                return (
                                    <button
                                        key={resume.id}
                                        type="button"
                                        onClick={() => selectResume(resume.id)}
                                        className={`w-full rounded-[18px] border px-4 py-3 text-left transition ${isActive
                                            ? 'border-slate-900 bg-slate-50'
                                            : 'border-slate-200 bg-white hover:border-slate-400'
                                            }`}
                                    >
                                        <div className="font-semibold text-slate-900">
                                            {resume.personal.fullName || 'Untitled Resume'}
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">
                                            {resume.personal.title || 'No title'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </AccordionSection>

                    <AccordionSection
                        id="photo"
                        title="Photo"
                        isOpen={openSection === 'photo'}
                        onToggle={handleToggleSection}
                    >
                        <div className="space-y-3">
                            {activeResume.personal.photo ? (
                                <img
                                    src={activeResume.personal.photo}
                                    alt={activeResume.personal.fullName}
                                    className="h-28 w-28 rounded-[18px] border border-slate-200 object-cover"
                                />
                            ) : (
                                <div className="flex h-28 w-28 items-center justify-center rounded-[18px] border border-dashed border-slate-300 text-sm text-slate-400">
                                    No photo
                                </div>
                            )}

                            <label className="block">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handlePhotoUpload(file);
                                    }}
                                />
                                <span className="inline-flex cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                                    Upload photo
                                </span>
                            </label>

                            {activeResume.personal.photo ? (
                                <button
                                    type="button"
                                    onClick={() => updatePersonalField('photo', '')}
                                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
                                >
                                    Remove photo
                                </button>
                            ) : null}
                        </div>
                    </AccordionSection>

                    <AccordionSection
                        id="personal"
                        title="Personal info"
                        isOpen={openSection === 'personal'}
                        onToggle={handleToggleSection}
                    >
                        <ResumePersonalSection
                            resume={activeResume}
                            onChangeField={updatePersonalField}
                            onEnableField={enablePersonalField}
                        />
                    </AccordionSection>

                    <ResumeExperienceEditor
                        items={activeResume.experience}
                        onAdd={addExperienceItem}
                        onChange={updateExperienceItem}
                        onRemove={removeExperienceItem}
                        isOpen={openSection === 'employment'}
                        onToggle={handleToggleSection}
                    />

                    <ResumeEducationEditor
                        items={activeResume.education}
                        onAdd={addEducationItem}
                        onChange={updateEducationItem}
                        onRemove={removeEducationItem}
                        isOpen={openSection === 'education'}
                        onToggle={handleToggleSection}
                    />

                    <ResumePercentageListEditor
                        id={'skills'}
                        title={'Skills'}
                        itemLabel={'Skill'}
                        namePlaceholder="React"
                        addButtonLabel="Add skill"
                        emptyStateText="No skills added yet."
                        items={activeResume.skills}
                        onAdd={addSkillItem}
                        onChange={updateSkillItem}
                        onRemove={removeSkillItem}
                        isOpen={openSection === 'skills'}
                        onToggle={handleToggleSection} />

                    <AccordionSection
                        id="languages"
                        title="Languages"
                        isOpen={openSection === 'languages'}
                        onToggle={handleToggleSection}
                        badge={
                            activeResume.languages.length ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                                    {activeResume.languages.length}
                                </span>
                            ) : null
                        }
                    >
                        <div className="text-sm text-slate-500">
                            Add language editor here next if you want full CRUD for languages too.
                        </div>
                    </AccordionSection>

                    <AccordionSection
                        id="additional-sections"
                        title="Additional sections"
                        isOpen={openSection === 'additional-sections'}
                        onToggle={handleToggleSection}
                    >
                        <ResumeAdditionalSectionsPanel
                            resume={activeResume}
                            onEnableSection={enableSection}
                        />
                    </AccordionSection>

                    {activeResume.enabledSections.qualities && (
                        <ResumePercentageListEditor
                            id={'qualities'}
                            title={'Qualities'}
                            itemLabel="Quality"
                            namePlaceholder="Leadership"
                            addButtonLabel="Add quality"
                            emptyStateText="No qualities added yet."
                            items={activeResume.qualities}
                            onAdd={addQualityItem}
                            onChange={updateQualityItem}
                            onRemove={removeQualityItem}
                            isOpen={openSection === 'qualities'}
                            onToggle={handleToggleSection}
                        />
                    )}

                    {activeResume.enabledSections.extracurricularActivities && (
                        <ResumeStringListEditor
                            id="extracurricular"
                            title="Extracurricular activities"
                            items={activeResume.extracurricularActivities}
                            placeholder="Activity"
                            onAdd={() => addSimpleStringArrayItem('extracurricularActivities')}
                            onChange={(index, value) =>
                                updateSimpleStringArray('extracurricularActivities', index, value)
                            }
                            onRemove={(index) =>
                                removeSimpleStringArrayItem('extracurricularActivities', index)
                            }
                            isOpen={openSection === 'extracurricular'}
                            onToggle={handleToggleSection}
                        />
                    )}

                    {activeResume.enabledSections.courses && (
                        <ResumeCoursesEditor
                            items={activeResume.courses}
                            onAdd={addCourseItem}
                            onChange={updateCourseItem}
                            onRemove={removeCourseItem}
                            isOpen={openSection === 'courses'}
                            onToggle={handleToggleSection}
                        />
                    )}

                    {activeResume.enabledSections.internships && (
                        <ResumeInternshipsEditor
                            items={activeResume.internships}
                            onAdd={addInternshipItem}
                            onChange={updateInternshipItem}
                            onRemove={removeInternshipItem}
                            isOpen={openSection === 'internships'}
                            onToggle={handleToggleSection}
                        />
                    )}

                    {activeResume.enabledSections.references && (
                        <ResumeReferencesEditor
                            items={activeResume.references}
                            onAdd={addReferenceItem}
                            onChange={updateReferenceItem}
                            onRemove={removeReferenceItem}
                            isOpen={openSection === 'references'}
                            onToggle={handleToggleSection}
                        />
                    )}

                    {activeResume.enabledSections.certificates && (
                        <ResumeCertificatesEditor
                            items={activeResume.certificates}
                            onAdd={addCertificateItem}
                            onChange={updateCertificateItem}
                            onRemove={removeCertificateItem}
                            isOpen={openSection === 'certificates'}
                            onToggle={handleToggleSection}
                        />
                    )}

                    {activeResume.enabledSections.achievements && (
                        <ResumeAchievementsEditor
                            items={activeResume.achievements}
                            onAdd={addAchievementItem}
                            onChange={updateAchievementItem}
                            onRemove={removeAchievementItem}
                            isOpen={openSection === 'achievements'}
                            onToggle={handleToggleSection}
                        />
                    )}

                    {activeResume.enabledSections.footer && (
                        <ResumeTextAreaSection
                            id="footer"
                            title="Footer"
                            value={activeResume.footer ?? ''}
                            placeholder="Footer text"
                            onChange={(value) => updateResume({ footer: value })}
                            isOpen={openSection === 'footer'}
                            onToggle={handleToggleSection}
                        />
                    )}

                    {activeResume.enabledSections.signature && (
                        <ResumeTextAreaSection
                            id="signature"
                            title="Signature"
                            value={activeResume.signature ?? ''}
                            placeholder="Signature / closing text"
                            onChange={(value) => updateResume({ signature: value })}
                            isOpen={openSection === 'signature'}
                            onToggle={handleToggleSection}
                        />
                    )}

                    <AccordionSection
                        id="accent"
                        title="Accent color"
                        isOpen={openSection === 'accent'}
                        onToggle={handleToggleSection}
                    >
                        <input
                            type="color"
                            value={activeResume.editorSettings.accentColor}
                            onChange={(e) =>
                                updateResume({
                                    editorSettings: {
                                        ...activeResume.editorSettings,
                                        accentColor: e.target.value
                                    }
                                })
                            }
                            className="h-11 w-full rounded-xl border border-slate-200 p-1"
                        />
                    </AccordionSection>
                </div>
            </div>

            <div className="min-w-0 flex-1">
                <div className="space-y-4">
                    <div className="flex justify-center">
                        <ResumeEditorPreview resume={activeResume} />
                    </div>

                    <div className="mx-auto w-full max-w-[1040px]">
                        <ResumeThemeRail
                            resume={activeResume}
                            selected={activeResume.editorSettings.template}
                            onSelect={(template) =>
                                updateResume({
                                    editorSettings: {
                                        ...activeResume.editorSettings,
                                        template
                                    }
                                })
                            }
                        />
                    </div>
                </div>

                <div
                    style={{
                        position: 'absolute',
                        left: '-10000px',
                        top: 0,
                        width: '794px',
                        minHeight: '1123px',
                        background: '#fff'
                    }}
                >
                    <ResumePrintPreview ref={printPreviewRef} resume={activeResume} />
                </div>
            </div>
        </div>
    );
};