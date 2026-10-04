import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { TextArea } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Section } from '../../ui/Layout';
import { useAi } from '../ai/AiSettings';
import { AiError } from '../ai/client';
import type { Resume } from '../resumes/model';
import { analyzeResume, scoreLabel, type AtsIssue, type Severity } from './analyze';
import type { Suggestion } from './ai';
import { FixWizard } from './FixWizard';
import { ScoreRing, scoreColor } from './ScoreRing';
import { TARGET_SCORE, useAts } from './useAts';
import { t } from '../../i18n';

const SEVERITY_STYLE: Record<Severity, { dot: string; label: string }> = {
  critical: { dot: 'bg-red-500', label: 'Critical' },
  major: { dot: 'bg-amber-500', label: 'Important' },
  minor: { dot: 'bg-slate-300', label: 'Tip' }
};
// Labels are translated where they are rendered.

type Props = {
  resume: Resume;
  onChange: (update: Partial<Resume>) => void;
  onGoTo: (target: AtsIssue['target']) => void;
  /** Opens the step-by-step wizard right away (after an import). */
  autoStartWizard?: boolean;
  onWizardStarted?: () => void;
};

export const AtsPanel = ({ resume, onChange, onGoTo, autoStartWizard, onWizardStarted }: Props) => {
  const report = useMemo(() => analyzeResume(resume), [resume]);
  const { hasKey, openSettings } = useAi();
  const { toast } = useFeedback();
  const ats = useAts(resume.id);
  const [wizard, setWizard] = useState<Suggestion[] | null>(null);
  const [jobDraft, setJobDraft] = useState(resume.ats.jobDescription);
  const startedRef = useRef(false);

  // Save the job ad shortly after typing stops.
  useEffect(() => {
    if (jobDraft === resume.ats.jobDescription) return;
    const timer = setTimeout(() => onChange({ ats: { ...resume.ats, jobDescription: jobDraft } }), 500);
    return () => clearTimeout(timer);
  }, [jobDraft, resume.ats, onChange]);

  const handleError = (error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    if (error instanceof AiError && error.kind === 'no-key') openSettings();
    toast(error instanceof Error ? error.message : t('Something went wrong.'), 'error');
  };

  const startWizard = async () => {
    if (!hasKey) {
      setWizard([]);
      return;
    }
    try {
      setWizard(await ats.getSuggestions());
    } catch (error) {
      handleError(error);
    }
  };

  useEffect(() => {
    if (!autoStartWizard || startedRef.current) return;
    startedRef.current = true;
    onWizardStarted?.();
    startWizard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartWizard]);

  const autoImprove = async () => {
    if (!hasKey) {
      openSettings();
      return;
    }
    try {
      const result = await ats.autoImprove();
      toast(t('ATS score {before} → {after}', { before: result.before, after: result.after }));
      // Hand over to the wizard for what only the user can do.
      setWizard(result.pendingSkills);
    } catch (error) {
      handleError(error);
    }
  };

  const fixable = report.issues.filter((issue) => issue.points > 0);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
        <div className="flex items-center gap-5">
          <ScoreRing score={report.score} size={104} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('ATS score')}</div>
            <div className="mt-0.5 text-xl font-bold" style={{ color: scoreColor(report.score) }}>
              {scoreLabel(report.score)}
            </div>
            <p className="mt-1 text-[13px] text-slate-500">
              {report.score >= TARGET_SCORE
                ? t('Ready to send. ATS systems will read it correctly and rank it well.')
                : t('{count} thing to fix to reach {target}+.|{count} things to fix to reach {target}+.', { count: fixable.length, target: TARGET_SCORE })}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {report.categories.map((category) => {
            const ratio = category.score / category.max;
            return (
              <div key={category.id} className="grid grid-cols-[150px_1fr_44px] items-center gap-3 text-[13px]">
                <span className="truncate text-slate-600">{category.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all" style={{ width: `${ratio * 100}%`, background: scoreColor(ratio * 100) }} />
                </div>
                <span className="text-right tabular-nums text-slate-500">
                  {Math.round(category.score)}/{category.max}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="accent" size="lg" icon="sparkle" onClick={autoImprove} disabled={Boolean(ats.busy)}>
            {t('Improve with AI to {target}+', { target: TARGET_SCORE })}
          </Button>
          <Button size="lg" icon="list" onClick={startWizard} disabled={Boolean(ats.busy)}>
            {t('Fix step by step')}
          </Button>
        </div>
        {ats.busy && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900" role="status">
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700" />
              {ats.busy.label}
              {ats.busy.round && ats.busy.round > 1 ? ` (${t('round {n}', { n: ats.busy.round })})` : ''}
            </span>
            <button type="button" onClick={ats.cancel} className="text-xs font-medium underline">
              {t('Cancel')}
            </button>
          </div>
        )}
        {ats.canUndo && !ats.busy && (
          <button type="button" onClick={ats.undo} className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900">
            <Icon name="refresh" className="h-3.5 w-3.5" />
            {t('Undo all AI changes')}
          </button>
        )}
        {!hasKey && (
          <p className="mt-3 text-xs text-slate-500">
            {t('The score and checks work offline. AI rewriting needs Claude:')}{' '}
            <button type="button" onClick={openSettings} className="font-medium text-indigo-600 hover:underline">
              {t('connect it in one minute')}
            </button>
            .
          </p>
        )}
      </section>

      <Section
        title={t('Target job')}
        icon="briefcase"
        description={
          resume.ats.jobDescription
            ? t('{matched} of {total} keywords matched', { matched: report.keywords.matched.length, total: report.keywords.matched.length + report.keywords.missing.length })
            : t('Paste a job ad to tailor your resume')
        }
      >
        <TextArea
          rows={5}
          value={jobDraft}
          onChange={setJobDraft}
          placeholder={t('Paste the full job ad here. The checker then measures how many of its keywords your resume contains.')}
          hint={t('Tailoring to each job is the single biggest factor in ATS ranking.')}
        />
        {jobDraft.trim() && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" icon="sparkle" onClick={() => (hasKey ? ats.analyzeJob().catch(handleError) : openSettings())} disabled={Boolean(ats.busy)}>
              {report.keywords.source === 'ai' ? t('Re-analyse with AI') : t('Find keywords with AI')}
            </Button>
            <span className="text-xs text-slate-500">
              {report.keywords.source === 'ai' ? t('Keywords extracted by Claude.') : t('Using a quick estimate. AI finds the keywords recruiters really screen for.')}
            </span>
          </div>
        )}
        {ats.assessment && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700">{ats.assessment}</p>}
        {report.keywords.matched.length + report.keywords.missing.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {report.keywords.matched.map((keyword) => (
              <span key={`m-${keyword}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <Icon name="check" className="h-3 w-3" />
                {keyword}
              </span>
            ))}
            {report.keywords.missing.map((keyword) => (
              <span key={`x-${keyword}`} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                <Icon name="x" className="h-3 w-3" />
                {keyword}
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title={t('What to fix')} icon="alert" description={report.issues.length ? t('{count} finding, most important first|{count} findings, most important first', { count: report.issues.length }) : t('Nothing left to fix')}>
        {report.issues.length === 0 ? (
          <p className="text-sm text-slate-500">{t('Everything checks out.')}</p>
        ) : (
          <ul className="-my-1 divide-y divide-slate-100">
            {report.issues.map((issue) => (
              <li key={issue.id} className="flex items-start gap-3 py-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_STYLE[issue.severity].dot}`} title={t(SEVERITY_STYLE[issue.severity].label)} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                    {issue.title}
                    {issue.points > 0 && <span className="text-xs font-normal text-slate-400">{t('+{n} pts', { n: issue.points })}</span>}
                    {issue.aiFixable && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">{t('AI can fix')}</span>}
                  </div>
                  <p className="mt-0.5 text-[13px] text-slate-500">{issue.detail}</p>
                </div>
                {issue.target && (
                  <Button size="sm" variant="ghost" iconRight="chevronRight" onClick={() => onGoTo(issue.target)}>
                    {t('Go')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {wizard && <FixWizard resumeId={resume.id} suggestions={wizard} onClose={() => setWizard(null)} onGoTo={onGoTo} />}
    </div>
  );
};
