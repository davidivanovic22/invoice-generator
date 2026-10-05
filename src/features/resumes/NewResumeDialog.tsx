import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { ImportDialog } from '../ats/ImportDialog';
import { useResumeStore } from './store';

const Option = ({ icon, title, text, onClick, primary }: { icon: IconName; title: string; text: string; onClick: () => void; primary?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    autoFocus={primary}
    className={`flex items-start gap-4 rounded-xl p-4 text-left transition ${primary ? 'ring-2 ring-indigo-500 hover:bg-indigo-50/50' : 'ring-1 ring-slate-200 hover:ring-slate-300'}`}
  >
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${primary ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
      <Icon name={icon} className="h-5 w-5" />
    </span>
    <span>
      <span className="block font-semibold text-slate-900">{title}</span>
      <span className="mt-0.5 block text-[13px] text-slate-500">{text}</span>
    </span>
  </button>
);

/** One entry point for every way to start a resume. */
export const NewResumeDialog = ({ onClose, startWithImport = false }: { onClose: () => void; startWithImport?: boolean }) => {
  const { createResume, addResume } = useResumeStore();
  const navigate = useNavigate();
  const [importing, setImporting] = useState(startWithImport);

  useEffect(() => {
    if (importing) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [importing, onClose]);

  if (importing)
    return (
      <ImportDialog
        onClose={onClose}
        onImported={(resume) => {
          addResume(resume);
          onClose();
          navigate(`/resumes/${resume.id}?tab=ats&wizard=1`);
        }}
      />
    );

  const start = (kind: 'sample' | 'empty') => {
    onClose();
    navigate(`/resumes/${createResume(kind).id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="new-resume-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="new-resume-title" className="text-lg font-semibold text-slate-900">
          {t('New resume')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('How would you like to start?')}</p>
        <div className="mt-5 grid gap-3">
          <Option
            primary
            icon="upload"
            title={t('I already have a CV')}
            text={t('Upload a PDF or Word file. AI rebuilds it and guides you through every improvement.')}
            onClick={() => setImporting(true)}
          />
          <Option icon="sparkle" title={t('From an example')} text={t('A complete, well-written resume you replace with your own details.')} onClick={() => start('sample')} />
          <Option icon="file" title={t('Start empty')} text={t('The usual sections, ready for you to fill in.')} onClick={() => start('empty')} />
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t('Cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};
