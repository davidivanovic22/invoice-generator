import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate, todayIso } from '../../../lib/dates';
import { downloadJson } from '../../../lib/files';
import { A4Thumbnail } from '../../../ui/A4Preview';
import { Button, IconButton } from '../../../ui/Button';
import { useFeedback } from '../../../ui/Feedback';
import { Icon } from '../../../ui/Icon';
import { ResumeDocument } from '../document/ResumeDocument';
import { RESUME_TEMPLATES } from '../document/templates';
import { resumeDisplayName } from '../model';
import { useResumeStore } from '../store';

const NewResumeDialog = ({ onPick, onClose }: { onPick: (kind: 'sample' | 'empty') => void; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby="new-resume-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <h2 id="new-resume-title" className="text-lg font-semibold text-slate-900">
        New resume
      </h2>
      <p className="mt-1 text-sm text-slate-500">How would you like to start?</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button type="button" autoFocus onClick={() => onPick('sample')} className="rounded-xl p-4 text-left ring-2 ring-indigo-500 transition hover:bg-indigo-50/50">
          <Icon name="sparkle" className="h-5 w-5 text-indigo-600" />
          <div className="mt-3 font-semibold text-slate-900">From an example</div>
          <div className="mt-1 text-[13px] text-slate-500">A complete, well-written resume you replace with your own details. Fastest way to a good result.</div>
        </button>
        <button type="button" onClick={() => onPick('empty')} className="rounded-xl p-4 text-left ring-1 ring-slate-200 transition hover:ring-slate-300">
          <Icon name="file" className="h-5 w-5 text-slate-500" />
          <div className="mt-3 font-semibold text-slate-900">Start empty</div>
          <div className="mt-1 text-[13px] text-slate-500">The usual sections, ready for you to fill in.</div>
        </button>
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  </div>
);

export const ResumeListPage = () => {
  const { store, createResume, duplicateResume, deleteResume, importBackup } = useResumeStore();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const [choosing, setChoosing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const resumes = [...store.resumes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const start = (kind: 'sample' | 'empty') => {
    setChoosing(false);
    navigate(`/resumes/${createResume(kind).id}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Resumes</h1>
          <p className="mt-1 text-sm text-slate-500">Keep a version per job or language. Everything is saved in this browser.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon="upload" onClick={() => fileRef.current?.click()}>
            Import
          </Button>
          <Button icon="download" onClick={() => downloadJson(store, `resumes-backup-${todayIso()}.json`)} disabled={!store.resumes.length}>
            Backup
          </Button>
          <Button variant="primary" size="lg" icon="plus" onClick={() => setChoosing(true)}>
            New resume
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              try {
                const added = importBackup(JSON.parse(await file.text()));
                toast(added ? `Imported ${added} resume${added === 1 ? '' : 's'}` : 'Nothing new to import', 'info');
              } catch (error) {
                toast(error instanceof Error ? error.message : 'That file could not be imported.', 'error');
              }
            }}
          />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="flex aspect-[794/1123] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white/60 text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Icon name="plus" className="h-6 w-6" />
          </span>
          <span className="text-sm font-medium">New resume</span>
        </button>
        {resumes.map((resume) => (
          <div key={resume.id} className="group">
            <Link to={`/resumes/${resume.id}`} className="block overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition group-hover:-translate-y-0.5 group-hover:shadow-md">
              <ThumbnailFill>
                <ResumeDocument resume={resume} />
              </ThumbnailFill>
            </Link>
            <div className="mt-2.5 flex items-start justify-between gap-2">
              <Link to={`/resumes/${resume.id}`} className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{resume.name}</div>
                <div className="truncate text-xs text-slate-500">
                  {resumeDisplayName(resume) !== resume.name ? `${resumeDisplayName(resume)} · ` : ''}
                  {RESUME_TEMPLATES[resume.design.template].name} · edited {formatDate(resume.updatedAt.slice(0, 10))}
                </div>
              </Link>
              <div className="flex shrink-0 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <IconButton
                  icon="copy"
                  label="Duplicate"
                  onClick={() => {
                    duplicateResume(resume.id);
                    toast('Copy created');
                  }}
                />
                <IconButton
                  icon="trash"
                  label="Delete"
                  tone="danger"
                  onClick={async () => {
                    const ok = await confirm({ title: `Delete "${resume.name}"?`, message: 'This removes it from this browser.', confirmLabel: 'Delete', tone: 'danger' });
                    if (ok) {
                      deleteResume(resume.id);
                      toast('Resume deleted');
                    }
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {choosing && <NewResumeDialog onPick={start} onClose={() => setChoosing(false)} />}
    </div>
  );
};

/** A thumbnail that fills its grid cell's width. */
const ThumbnailFill = ({ children }: { children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="aspect-[794/1123] w-full">
      {width > 0 && <A4Thumbnail width={width}>{children}</A4Thumbnail>}
    </div>
  );
};
