import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { safeFileName } from '../../lib/files';
import { printToPdf } from '../../lib/pdf';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { TextArea } from '../../ui/Field';
import { useAi } from '../ai/AiSettings';
import type { Resume } from '../resumes/model';
import { useResumeStore } from '../resumes/store';

type Props = { resume: Resume; onClose: () => void };

/** View, edit, (re)write and export the cover letter that belongs to a resume. */
export const CoverLetterDialog = ({ resume, onClose }: Props) => {
  const { updateResume } = useResumeStore();
  const { hasKey, openSettings } = useAi();
  const { toast } = useFeedback();
  const [text, setText] = useState(resume.coverLetter ?? '');
  const [writing, setWriting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const jobAd = resume.ats.jobDescription.trim();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !writing && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, writing]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const save = (value: string) => {
    setText(value);
    updateResume(resume.id, (current) => ({ ...current, coverLetter: value }));
  };

  const write = async () => {
    if (!hasKey) return openSettings();
    setWriting(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { writeCoverLetter } = await import('./ai');
      save(await writeCoverLetter(resume, jobAd, '', controller.signal));
    } catch (caught) {
      if ((caught as Error).name !== 'AbortError') toast((caught as Error).message, 'error');
    } finally {
      setWriting(false);
    }
  };

  const exportPdf = async () => {
    if (!printRef.current) return;
    toast(t('In the window that opens, choose "Save as PDF".'), 'info');
    await printToPdf(printRef.current, safeFileName(`${resume.design.language === 'sr' ? 'Propratno-pismo' : 'Cover-letter'}-${resume.personal.fullName || resume.name}`));
  };

  const contact = [resume.personal.email, resume.personal.phone, resume.personal.location].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onMouseDown={() => !writing && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="letter-title" className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 id="letter-title" className="text-lg font-semibold text-slate-900">
            {t('Cover letter')}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{jobAd ? t('Written for the job ad saved in the ATS check of this resume.') : t('Add a job ad in the ATS check first, so the letter can be written for it.')}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <TextArea rows={16} value={text} onChange={save} placeholder={writing ? t('Writing…') : t('Your cover letter will appear here. You can also write or paste it yourself.')} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-4">
          <Button icon="sparkle" onClick={write} disabled={writing || !jobAd}>
            {writing ? t('Writing…') : text ? t('Write again') : t('Write with AI')}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              icon="copy"
              disabled={!text}
              onClick={() => {
                void navigator.clipboard?.writeText(text);
                toast(t('Copied'));
              }}
            >
              {t('Copy')}
            </Button>
            <Button icon="download" onClick={exportPdf} disabled={!text}>
              PDF
            </Button>
            <Button variant="primary" onClick={onClose}>
              {t('Done')}
            </Button>
          </div>
        </div>
      </div>
      <div className="light-scope pointer-events-none fixed left-[-10000px] top-0" aria-hidden="true">
        <div ref={printRef}>
          <div data-pdf-page className="box-border w-[210mm] bg-white px-[22mm] py-[20mm] font-sans text-[11pt] leading-relaxed text-slate-900" style={{ minHeight: '297mm' }}>
            <div className="border-b border-slate-200 pb-4">
              <div className="text-[18pt] font-bold tracking-tight">{resume.personal.fullName}</div>
              {resume.personal.headline && <div className="text-[11pt] text-slate-600">{resume.personal.headline}</div>}
              {contact && <div className="mt-1 text-[9.5pt] text-slate-500">{contact}</div>}
            </div>
            <div className="mt-8 whitespace-pre-wrap">{text}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
