import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n';
import { Button } from '../../ui/Button';
import { TextArea, TextField } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { useAi } from '../ai/AiSettings';
import type { Resume } from '../resumes/model';
import { useResumeStore } from '../resumes/store';
import { analyzeResume } from './analyze';
import type { TailorResult, TailorStep } from './ai';
import { ScoreRing } from './ScoreRing';

type Props = { resume: Resume; onClose: () => void };

const STEPS: { id: TailorStep; label: string }[] = [
  { id: 'reading', label: 'Reading the job ad' },
  { id: 'rewriting', label: 'Tailoring your resume' },
  { id: 'letter', label: 'Writing the cover letter' }
];

/** Paste a job ad: get a tailored copy of the resume (the original stays) and a cover letter. */
export const TailorDialog = ({ resume, onClose }: Props) => {
  const { hasKey, openSettings } = useAi();
  const { addResume } = useResumeStore();
  const navigate = useNavigate();
  const [jobAd, setJobAd] = useState(resume.ats.jobDescription);
  const [company, setCompany] = useState('');
  const [withLetter, setWithLetter] = useState(true);
  const [step, setStep] = useState<TailorStep | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<(TailorResult & { before: number; after: number }) | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !step && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    if (!hasKey) {
      openSettings();
      return;
    }
    setError('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { tailorResume, writeCoverLetter } = await import('./ai');
      const tailored = await tailorResume(resume, jobAd.trim(), company, setStep, analyzeResume, controller.signal);
      let tailoredResume = tailored.resume;
      if (withLetter) {
        setStep('letter');
        tailoredResume = { ...tailoredResume, coverLetter: await writeCoverLetter(tailoredResume, jobAd.trim(), company, controller.signal) };
      }
      // Score the original against the same job ad, so the numbers compare.
      const before = analyzeResume({ ...resume, ats: tailoredResume.ats }).score;
      const after = analyzeResume(tailoredResume).score;
      addResume(tailoredResume);
      setResult({ ...tailored, resume: tailoredResume, before, after });
    } catch (caught) {
      if ((caught as Error).name !== 'AbortError') setError((caught as Error).message || t('Something went wrong. Please try again.'));
    } finally {
      setStep(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onMouseDown={() => !step && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="tailor-title" className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 id="tailor-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Icon name="sparkle" className="h-5 w-5 text-indigo-600" />
            {t('Tailor to a job ad')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t('Eden AI makes a copy of "{name}" written for this job. Your original resume stays as it is.', { name: resume.name })}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {result ? (
            <div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="text-center">
                  <ScoreRing score={result.before} size={72} />
                  <div className="mt-1 text-xs text-slate-500">{t('Before')}</div>
                </div>
                <Icon name="chevronRight" className="h-6 w-6 text-slate-300" />
                <div className="text-center">
                  <ScoreRing score={result.after} size={72} />
                  <div className="mt-1 text-xs text-slate-500">{t('Tailored')}</div>
                </div>
                <div className="min-w-0 flex-1 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">{result.resume.name}</p>
                  <p className="mt-1">{t('{count} change applied|{count} changes applied', { count: result.applied })}</p>
                  {result.resume.coverLetter && <p className="mt-0.5 text-emerald-700">{t('Cover letter written')}</p>}
                </div>
              </div>
              {result.unproven.length > 0 && (
                <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm ring-1 ring-amber-200">
                  <p className="font-medium text-amber-900">{t('The ad asks for skills your resume does not show:')}</p>
                  <p className="mt-1 text-amber-800">{result.unproven.join(', ')}</p>
                  <p className="mt-2 text-xs text-amber-700">{t('They were not added. If you have them, the ATS check in the new resume lets you add them with one click.')}</p>
                </div>
              )}
            </div>
          ) : step ? (
            <ol className="space-y-3 py-4">
              {STEPS.filter((item) => withLetter || item.id !== 'letter').map((item) => {
                const order = STEPS.findIndex((candidate) => candidate.id === item.id);
                const current = STEPS.findIndex((candidate) => candidate.id === step);
                const state = order < current ? 'done' : order === current ? 'active' : 'waiting';
                return (
                  <li key={item.id} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full ${
                        state === 'done' ? 'bg-emerald-500 text-white' : state === 'active' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {state === 'done' ? <Icon name="check" className="h-4 w-4" /> : state === 'active' ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" /> : order + 1}
                    </span>
                    <span className={state === 'waiting' ? 'text-slate-400' : 'font-medium text-slate-900'}>{t(item.label)}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="space-y-4">
              <TextArea label={t('Job ad')} rows={10} value={jobAd} onChange={setJobAd} placeholder={t('Paste the whole job ad here: title, requirements, responsibilities…')} />
              <TextField label={t('Company (optional)')} value={company} onChange={setCompany} placeholder="Acme d.o.o." />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={withLetter} onChange={(event) => setWithLetter(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                {t('Also write a cover letter')}
              </label>
              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {result ? (
            <>
              <Button onClick={onClose}>{t('Close')}</Button>
              <Button
                variant="accent"
                icon="pen"
                onClick={() => {
                  onClose();
                  navigate(`/resumes/${result.resume.id}`);
                }}
              >
                {t('Open tailored resume')}
              </Button>
            </>
          ) : step ? (
            <Button onClick={() => abortRef.current?.abort()}>{t('Cancel')}</Button>
          ) : (
            <>
              <Button onClick={onClose}>{t('Cancel')}</Button>
              <Button variant="accent" icon="sparkle" onClick={run} disabled={jobAd.trim().length < 80}>
                {hasKey ? t('Tailor my resume') : t('Connect Eden AI')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
