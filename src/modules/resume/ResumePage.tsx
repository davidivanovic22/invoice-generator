import { useRef } from 'react';
import { useResumes } from '../../hooks/useResumes';
import { downloadDocumentPdf, previewDocumentPdf } from '../../utils/pdf';
import { ResumeEditorPreview } from '../../components/resume/ResumeEditorPreview';
import { ResumePrintPreview } from '../../components/resume/ResumePrintPreview';
import { ResumeThemeRail } from '../../components/resume/ResumeThemeRail';
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
        exportCurrentResume,
        exportAllResumes,
        importFromJson
    } = useResumes();

    const printPreviewRef = useRef<HTMLDivElement | null>(null);
    const fileReaderRef = useRef<FileReader | null>(null);

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

                    <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <div className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-500">
                            Resume list
                        </div>

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
                    </div>

                    <ImportExportPanel
                        onExportCurrent={exportCurrentResume}
                        onExportAll={exportAllResumes}
                        onResetCurrent={resetActiveResume}
                        onImport={handleImport}
                    />

                    <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <div className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-slate-500">
                            Photo
                        </div>

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
                    </div>

                    <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <div className="mb-4 text-sm font-bold uppercase tracking-[0.22em] text-slate-500">
                            Personal info
                        </div>

                        <div className="grid gap-3">
                            <input
                                value={activeResume.personal.fullName}
                                onChange={(e) => updatePersonalField('fullName', e.target.value)}
                                placeholder="Full name"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                            <input
                                value={activeResume.personal.title}
                                onChange={(e) => updatePersonalField('title', e.target.value)}
                                placeholder="Professional title"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                            <input
                                value={activeResume.personal.phone}
                                onChange={(e) => updatePersonalField('phone', e.target.value)}
                                placeholder="Phone"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                            <input
                                value={activeResume.personal.email}
                                onChange={(e) => updatePersonalField('email', e.target.value)}
                                placeholder="Email"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                            <input
                                value={activeResume.personal.address}
                                onChange={(e) => updatePersonalField('address', e.target.value)}
                                placeholder="Address"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                            <input
                                value={activeResume.personal.linkedin ?? ''}
                                onChange={(e) => updatePersonalField('linkedin', e.target.value)}
                                placeholder="LinkedIn"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                            <input
                                value={activeResume.personal.github ?? ''}
                                onChange={(e) => updatePersonalField('github', e.target.value)}
                                placeholder="GitHub"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                            <input
                                value={activeResume.personal.website ?? ''}
                                onChange={(e) => updatePersonalField('website', e.target.value)}
                                placeholder="Website"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                        </div>
                    </div>

                    <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <div className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-500">
                            Accent color
                        </div>

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
                    </div>
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