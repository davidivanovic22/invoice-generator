import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AtsPanel } from '../../ats/AtsPanel';
import { analyzeResume, type AtsIssue } from '../../ats/analyze';
import { scoreColor } from '../../ats/ScoreRing';
import { safeFileName } from '../../../lib/files';
import { printToPdf } from '../../../lib/pdf';
import { A4Preview } from '../../../ui/A4Preview';
import { Button, IconButton } from '../../../ui/Button';
import { useFeedback } from '../../../ui/Feedback';
import { Icon } from '../../../ui/Icon';
import { EmptyState, Segmented } from '../../../ui/Layout';
import { ResumeDocument } from '../document/ResumeDocument';
import { DesignPanel } from '../editor/DesignPanel';
import { PersonalSection } from '../editor/PersonalSection';
import { SectionCard } from '../editor/SectionCard';
import { createSection, SECTION_KINDS, type Resume, type ResumeSection, type SectionKind } from '../model';
import { useResumeStore } from '../store';

const ADDABLE: SectionKind[] = ['summary', 'experience', 'education', 'skills', 'languages', 'projects', 'certificates', 'courses', 'awards', 'volunteering', 'internships', 'references', 'interests', 'custom'];
const REPEATABLE: SectionKind[] = ['custom', 'skills'];

const AddSectionMenu = ({ sections, onAdd }: { sections: ResumeSection[]; onAdd: (kind: SectionKind) => void }) => {
  const [open, setOpen] = useState(false);
  const available = ADDABLE.filter((kind) => REPEATABLE.includes(kind) || !sections.some((section) => section.kind === kind));
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/50">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-center gap-2 px-5 py-3.5 text-sm font-medium text-slate-600 hover:text-slate-900">
        <Icon name="plus" />
        Add section
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-1.5 px-3 pb-3 sm:grid-cols-2">
          {available.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                onAdd(kind);
                setOpen(false);
              }}
              className="rounded-xl bg-white px-3 py-2.5 text-left ring-1 ring-slate-200 transition hover:ring-indigo-300"
            >
              <div className="text-sm font-medium text-slate-900">{SECTION_KINDS[kind].title}</div>
              <div className="text-xs text-slate-500">{SECTION_KINDS[kind].description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ResumeEditorPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { store, updateResume, deleteResume, duplicateResume } = useResumeStore();
  const { confirm, toast } = useFeedback();
  const resume = store.resumes.find((candidate) => candidate.id === id);
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'ats' ? 'ats' : 'content';
  const setTab = (next: 'content' | 'ats') => setSearchParams(next === 'ats' ? { tab: 'ats' } : {}, { replace: true });
  const [focus, setFocus] = useState<{ sectionId: string; token: number } | null>(null);
  const atsScore = useMemo(() => (resume ? analyzeResume(resume).score : 0), [resume]);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const latest = useRef(resume);
  latest.current = resume;

  const update = useCallback((patch: Partial<Resume> | ((resume: Resume) => Resume)) => updateResume(id, patch), [id, updateResume]);

  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    const count = () => setPageCount(node.querySelectorAll('[data-pdf-page]').length || 1);
    count();
    const observer = new MutationObserver(count);
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [resume?.id]);


  if (!resume) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon="file"
          title="Resume not found"
          description="It may have been deleted, or it was created in another browser."
          action={
            <Link to="/resumes">
              <Button variant="primary">Back to resumes</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const exportPdf = async () => {
    const node = exportRef.current;
    if (!node) return;
    setExporting(true);
    try {
      await printToPdf(node, safeFileName(`${resume.personal.fullName || resume.name}-CV`, 'resume'));
    } catch (error) {
      console.error(error);
      toast('The PDF could not be created. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const goTo = (target: AtsIssue['target']) => {
    setTab('content');
    setMobileView('edit');
    if (target?.sectionId) setFocus({ sectionId: target.sectionId, token: Date.now() });
    else requestAnimationFrame(() => document.getElementById('personal')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const setSections = (sections: ResumeSection[]) => update({ sections });
  const moveSection = (index: number, delta: number) => {
    const next = [...resume.sections];
    const [section] = next.splice(index, 1);
    next.splice(index + delta, 0, section);
    setSections(next);
  };
  const removeSection = async (section: ResumeSection) => {
    const hasContent = section.type === 'text' ? section.text.trim() : section.items.length > 0;
    if (hasContent) {
      const ok = await confirm({ title: `Delete "${section.title}"?`, message: 'Its content will be removed. You can hide a section instead to keep it.', confirmLabel: 'Delete', tone: 'danger' });
      if (!ok) return;
    }
    setSections(resume.sections.filter((other) => other.id !== section.id));
  };

  const handleDelete = async () => {
    const ok = await confirm({ title: `Delete "${resume.name}"?`, message: 'This removes it from this browser.', confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    deleteResume(resume.id);
    navigate('/resumes');
    toast('Resume deleted');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-14 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-6">
          <Link to="/resumes" className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <Icon name="chevronLeft" />
            <span className="hidden sm:inline">Resumes</span>
          </Link>
          <input
            aria-label="Resume name"
            value={resume.name}
            onChange={(event) => update({ name: event.target.value })}
            className="min-w-0 max-w-xs flex-1 rounded-md border-0 bg-transparent px-2 py-1 text-[15px] font-semibold text-slate-900 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="hidden text-xs text-slate-400 md:inline">
            {pageCount} page{pageCount === 1 ? '' : 's'}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <IconButton
              icon="copy"
              label="Duplicate resume"
              className="hidden sm:inline-flex"
              onClick={() => {
                const copy = duplicateResume(resume.id);
                if (copy) {
                  navigate(`/resumes/${copy.id}`);
                  toast('Copy created');
                }
              }}
            />
            <IconButton icon="trash" label="Delete resume" tone="danger" onClick={handleDelete} />
            <Button variant="primary" icon="download" onClick={exportPdf} disabled={exporting} title="Opens the save dialog: choose “Save as PDF”">
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] px-4 pt-4 sm:px-6 lg:hidden">
        <Segmented
          value={mobileView}
          onChange={setMobileView}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'preview', label: 'Preview' }
          ]}
        />
      </div>

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(420px,560px)_1fr]">
        <div className={`min-w-0 space-y-4 ${mobileView === 'preview' ? 'hidden lg:block' : ''}`}>
          <div className="flex rounded-xl bg-slate-200/60 p-1" role="tablist" aria-label="Editor mode">
            {(['content', 'ats'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {value === 'content' ? (
                  <>
                    <Icon name="pen" /> Content
                  </>
                ) : (
                  <>
                    <Icon name="sparkle" /> ATS check
                    <span className="rounded-full px-1.5 text-xs font-semibold text-white" style={{ background: scoreColor(atsScore) }}>
                      {atsScore}
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
          {tab === 'ats' ? (
            <AtsPanel
              resume={resume}
              onChange={update}
              onGoTo={goTo}
              autoStartWizard={searchParams.get('wizard') === '1'}
              onWizardStarted={() => setSearchParams({ tab: 'ats' }, { replace: true })}
            />
          ) : (
            <>
          <PersonalSection personal={resume.personal} onChange={(personal) => update({ personal })} />
            {resume.sections.map((section, index) => (
              <SectionCard
                key={section.id}
                section={section}
                onChange={(next) => setSections(resume.sections.map((other) => (other.id === section.id ? next : other)))}
                onRemove={() => removeSection(section)}
                onMove={(delta) => moveSection(index, delta)}
                canMoveUp={index > 0}
                canMoveDown={index < resume.sections.length - 1}
                focusToken={focus?.sectionId === section.id ? focus.token : undefined}
              />
            ))}
            <AddSectionMenu sections={resume.sections} onAdd={(kind) => setSections([...resume.sections, createSection(kind)])} />
            <DesignPanel resume={resume} onChange={(design) => update({ design })} />
            </>
          )}
        </div>
        <div className={`min-w-0 ${mobileView === 'edit' ? 'hidden lg:block' : ''}`}>
          <div className="sticky top-[124px] max-h-[calc(100vh-140px)] overflow-y-auto rounded-xl pb-2 lg:pr-1">
            <div ref={previewRef} className="[&_[data-pdf-page]]:shadow-[0_1px_3px_rgba(15,23,42,0.08),0_12px_40px_-12px_rgba(15,23,42,0.25)] [&_[data-pdf-page]]:ring-1 [&_[data-pdf-page]]:ring-slate-200">
              <A4Preview>
                <ResumeDocument ref={exportRef} resume={resume} />
              </A4Preview>
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">Live preview · saved automatically in this browser</p>
          </div>
        </div>
      </div>

    </div>
  );
};
