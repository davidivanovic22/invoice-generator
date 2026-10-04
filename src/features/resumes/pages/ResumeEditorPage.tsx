import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { t } from '../../../i18n';
import { safeFileName } from '../../../lib/files';
import { printToPdf } from '../../../lib/pdf';
import { A4Preview } from '../../../ui/A4Preview';
import { Button } from '../../../ui/Button';
import { EditorToolbar, editTargetFrom, flash, MobileViewSwitch, PreviewHint, useUndoShortcuts } from '../../../ui/EditorChrome';
import { useFeedback } from '../../../ui/Feedback';
import { Icon } from '../../../ui/Icon';
import { EmptyState } from '../../../ui/Layout';
import { AtsPanel } from '../../ats/AtsPanel';
import { analyzeResume, type AtsIssue } from '../../ats/analyze';
import { scoreColor } from '../../ats/ScoreRing';
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
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 px-5 py-3.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <Icon name="plus" />
        {t('Add section')}
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
              <div className="text-sm font-medium text-slate-900">{t(SECTION_KINDS[kind].title)}</div>
              <div className="text-xs text-slate-500">{t(SECTION_KINDS[kind].description)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

type Focus = { sectionId: string; itemId?: string; token: number };

export const ResumeEditorPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { store, updateResume, deleteResume, duplicateResume, addResume, undo, redo, canUndo, canRedo } = useResumeStore();
  const { toast } = useFeedback();
  const resume = store.resumes.find((candidate) => candidate.id === id);
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'ats' ? 'ats' : 'content';
  const setTab = (next: 'content' | 'ats') => setSearchParams(next === 'ats' ? { tab: 'ats' } : {}, { replace: true });
  const [focus, setFocus] = useState<Focus | null>(null);
  const atsScore = useMemo(() => (resume ? analyzeResume(resume).score : 0), [resume]);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);

  const update = useCallback((patch: Partial<Resume> | ((resume: Resume) => Resume)) => updateResume(id, patch), [id, updateResume]);
  const onUndo = useCallback(() => undo(id), [id, undo]);
  const onRedo = useCallback(() => redo(id), [id, redo]);
  useUndoShortcuts(onUndo, onRedo);

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
          title={t('Resume not found')}
          description={t('It may have been deleted, or it was created in another browser.')}
          action={
            <Link to="/resumes">
              <Button variant="primary">{t('Back to resumes')}</Button>
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
    toast(t('In the window that opens, choose "Save as PDF".'), 'info');
    try {
      await printToPdf(node, safeFileName(`${resume.personal.fullName || resume.name}-CV`, 'resume'));
    } catch (error) {
      console.error(error);
      toast(t('The PDF could not be created. Please try again.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  /** Opens the editor for a section (and entry), from the ATS panel or a click in the preview. */
  const openSection = (sectionId?: string, itemId?: string) => {
    setTab('content');
    setMobileView('edit');
    if (sectionId && sectionId !== 'personal') {
      setFocus({ sectionId, itemId, token: Date.now() });
      setTimeout(() => flash(document.getElementById(`section-${sectionId}`)), 250);
    } else {
      requestAnimationFrame(() => {
        const element = document.getElementById('personal');
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        flash(element);
      });
    }
  };

  const goTo = (target: AtsIssue['target']) => openSection(target?.sectionId, target?.itemId);

  const setSections = (sections: ResumeSection[]) => update({ sections });
  const moveSection = (index: number, delta: number) => {
    const next = [...resume.sections];
    const [section] = next.splice(index, 1);
    next.splice(index + delta, 0, section);
    setSections(next);
  };
  const removeSection = (section: ResumeSection) => {
    setSections(resume.sections.filter((other) => other.id !== section.id));
    toast(t('"{name}" removed', { name: section.title }), 'success', { label: t('Undo'), onClick: onUndo });
  };

  const handleDelete = () => {
    const removed = deleteResume(resume.id);
    navigate('/resumes');
    if (removed) toast(t('Resume deleted'), 'success', { label: t('Undo'), onClick: () => addResume(removed) });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorToolbar
        backTo="/resumes"
        backLabel={t('Resumes')}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo(id)}
        canRedo={canRedo(id)}
        title={
          <>
            <input
              aria-label={t('Resume name')}
              value={resume.name}
              onChange={(event) => update({ name: event.target.value })}
              className="min-w-0 max-w-xs flex-1 rounded-md border-0 bg-transparent px-2 py-1 text-[15px] font-semibold text-slate-900 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="hidden shrink-0 text-xs text-slate-400 md:inline">{t('{count} page|{count} pages', { count: pageCount })}</span>
          </>
        }
        menu={[
          {
            label: t('Duplicate'),
            icon: 'copy',
            onSelect: () => {
              const copy = duplicateResume(resume.id);
              if (copy) {
                navigate(`/resumes/${copy.id}`);
                toast(t('Copy created'));
              }
            }
          },
          'divider',
          { label: t('Delete resume'), icon: 'trash', danger: true, onSelect: handleDelete }
        ]}
      >
        <Button variant="primary" icon="download" onClick={exportPdf} disabled={exporting}>
          <span className="hidden sm:inline">{t('Download PDF')}</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </EditorToolbar>

      <MobileViewSwitch value={mobileView} onChange={setMobileView} />

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(420px,560px)_1fr]">
        <div className={`min-w-0 space-y-4 ${mobileView === 'preview' ? 'hidden lg:block' : ''}`}>
          <div className="flex rounded-xl bg-slate-200/60 p-1" role="tablist" aria-label={t('Editor mode')}>
            {(['content', 'ats'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  tab === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {value === 'content' ? (
                  <>
                    <Icon name="pen" /> {t('Content')}
                  </>
                ) : (
                  <>
                    <Icon name="sparkle" /> {t('ATS check')}
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
                  language={resume.design.language}
                  onChange={(next) => setSections(resume.sections.map((other) => (other.id === section.id ? next : other)))}
                  onRemove={() => removeSection(section)}
                  onMove={(delta) => moveSection(index, delta)}
                  canMoveUp={index > 0}
                  canMoveDown={index < resume.sections.length - 1}
                  focus={focus?.sectionId === section.id ? focus : undefined}
                />
              ))}
              <AddSectionMenu
                sections={resume.sections}
                onAdd={(kind) => {
                  const section = createSection(kind, undefined, resume.design.language);
                  setSections([...resume.sections, section]);
                  openSection(section.id);
                }}
              />
              <DesignPanel resume={resume} onChange={(next) => update(() => next)} />
            </>
          )}
        </div>
        <div className={`min-w-0 ${mobileView === 'edit' ? 'hidden lg:block' : ''}`}>
          <div className="sticky top-[124px] max-h-[calc(100vh-140px)] overflow-y-auto rounded-xl pb-2 lg:pr-1">
            <div
              ref={previewRef}
              className="editable-preview [&_[data-pdf-page]]:shadow-[0_1px_3px_rgba(15,23,42,0.08),0_12px_40px_-12px_rgba(15,23,42,0.25)] [&_[data-pdf-page]]:ring-1 [&_[data-pdf-page]]:ring-slate-200"
              onClick={(event) => {
                const target = editTargetFrom(event);
                if (target) openSection(target.target, target.item);
              }}
            >
              <A4Preview>
                <ResumeDocument ref={exportRef} resume={resume} />
              </A4Preview>
            </div>
            <PreviewHint />
          </div>
        </div>
      </div>
    </div>
  );
};
