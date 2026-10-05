import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { t, uiLocale } from '../../../i18n';
import { formatDate, todayIso } from '../../../lib/dates';
import { downloadJson } from '../../../lib/files';
import { A4Thumbnail } from '../../../ui/A4Preview';
import { Button } from '../../../ui/Button';
import { useFeedback } from '../../../ui/Feedback';
import { Icon } from '../../../ui/Icon';
import { Menu } from '../../../ui/Menu';
import { ResumeDocument } from '../document/ResumeDocument';
import { RESUME_TEMPLATES } from '../document/templates';
import { resumeDisplayName } from '../model';
import { TailorDialog } from '../../ats/TailorDialog';
import { NewResumeDialog } from '../NewResumeDialog';
import { useResumeStore } from '../store';

export const ResumeListPage = () => {
  const { store, duplicateResume, deleteResume, importBackup, addResume } = useResumeStore();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const [choosing, setChoosing] = useState<false | 'choose' | 'import'>(false);
  const [tailoring, setTailoring] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // ?new=1 / ?import=1 (from the command palette) open the right dialog.
  useEffect(() => {
    const mode = searchParams.get('import') === '1' ? 'import' : searchParams.get('new') === '1' ? 'choose' : null;
    if (!mode) return;
    setChoosing(mode);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);
  const resumes = [...store.resumes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('Resumes')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('Keep a version per job or language. Everything is saved in this browser.')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Menu
            label={t('Backup and restore')}
            items={[
              { label: t('Download backup'), icon: 'download', onSelect: () => downloadJson(store, `resumes-backup-${todayIso()}.json`), disabled: !store.resumes.length },
              { label: t('Restore from backup'), icon: 'upload', onSelect: () => fileRef.current?.click() }
            ]}
          />
          <Button variant="primary" size="lg" icon="plus" onClick={() => setChoosing('choose')}>
            {t('New resume')}
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
                toast(added ? t('Imported {count} resume|Imported {count} resumes', { count: added }) : t('Nothing new to import'), 'info');
              } catch (error) {
                toast(error instanceof Error ? error.message : t('That file could not be imported.'), 'error');
              }
            }}
          />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setChoosing('choose')}
          className="flex aspect-[794/1123] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white/60 text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Icon name="plus" className="h-6 w-6" />
          </span>
          <span className="text-sm font-medium">{t('New resume')}</span>
        </button>
        {resumes.map((resume) => (
          <div key={resume.id} className="group">
            <Link
              to={`/resumes/${resume.id}`}
              className="block overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition group-hover:-translate-y-0.5 group-hover:shadow-md"
            >
              <ThumbnailFill>
                <ResumeDocument resume={resume} />
              </ThumbnailFill>
            </Link>
            <div className="mt-2.5 flex items-start justify-between gap-2">
              <Link to={`/resumes/${resume.id}`} className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{resume.name}</div>
                <div className="truncate text-xs text-slate-500">
                  {resumeDisplayName(resume) !== resume.name ? `${resumeDisplayName(resume)} · ` : ''}
                  {t(RESUME_TEMPLATES[resume.design.template].name)} · {t('edited {date}', { date: formatDate(resume.updatedAt.slice(0, 10), uiLocale()) })}
                </div>
              </Link>
              <Menu
                label={t('Resume options')}
                items={[
                  { label: t('Open'), icon: 'pen', onSelect: () => navigate(`/resumes/${resume.id}`) },
                  { label: t('Tailor to a job ad'), icon: 'sparkle', onSelect: () => setTailoring(resume.id) },
                  {
                    label: t('Duplicate'),
                    icon: 'copy',
                    onSelect: () => {
                      duplicateResume(resume.id);
                      toast(t('Copy created'));
                    }
                  },
                  'divider',
                  {
                    label: t('Delete'),
                    icon: 'trash',
                    danger: true,
                    onSelect: () => {
                      const removed = deleteResume(resume.id);
                      if (removed) toast(t('Resume deleted'), 'success', { label: t('Undo'), onClick: () => addResume(removed) });
                    }
                  }
                ]}
              />
            </div>
          </div>
        ))}
      </div>

      {tailoring && store.resumes.some((resume) => resume.id === tailoring) && (
        <TailorDialog resume={store.resumes.find((resume) => resume.id === tailoring)!} onClose={() => setTailoring(null)} />
      )}
      {choosing && <NewResumeDialog startWithImport={choosing === 'import'} onClose={() => setChoosing(false)} />}
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
