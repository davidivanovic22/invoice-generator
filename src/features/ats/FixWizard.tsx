import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../ui/Button';
import { inputClass, TextField } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import type { EntriesSection, PersonalInfo, Resume } from '../resumes/model';
import { useResumeStore } from '../resumes/store';
import { analyzeResume, scoreLabel, type AtsIssue } from './analyze';
import { applySuggestion, suggestionBefore, suggestionLabel, type Suggestion } from './ai';
import { ScoreRing } from './ScoreRing';
import { t } from '../../i18n';

type Step =
  | { kind: 'suggestion'; id: string; suggestion: Suggestion }
  | { kind: 'contact'; id: string }
  | { kind: 'dates'; id: string }
  | { kind: 'placeholders'; id: string }
  | { kind: 'manual'; id: string; issue: AtsIssue };

const ORDER: Suggestion['type'][] = ['headline', 'summary', 'entry_description', 'skills_add', 'skills_confirm'];
const PLACEHOLDER = /\[[^\]\n]{1,40}\]/;
const HANDLED_ISSUES = new Set(['contact-0', 'contact-1', 'contact-2', 'contact-3', 'contact-4', 'structure-dates', 'readability-placeholders']);

export const buildSteps = (resume: Resume, suggestions: Suggestion[]): Step[] => {
  const report = analyzeResume(resume);
  const ids = new Set(report.issues.map((issue) => issue.id));
  const steps: Step[] = [...suggestions]
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type))
    .map((suggestion, index) => ({ kind: 'suggestion' as const, id: `s-${index}`, suggestion }));
  if (['contact-0', 'contact-1', 'contact-2', 'contact-3', 'contact-4'].some((id) => ids.has(id))) steps.push({ kind: 'contact', id: 'contact' });
  if (ids.has('structure-dates')) steps.push({ kind: 'dates', id: 'dates' });
  for (const issue of report.issues) {
    if (!issue.aiFixable && !HANDLED_ISSUES.has(issue.id) && issue.points > 0) steps.push({ kind: 'manual', id: issue.id, issue });
  }
  // Last, because Claude's rewrites can add placeholders.
  steps.push({ kind: 'placeholders', id: 'placeholders' });
  return steps;
};

type Props = {
  resumeId: string;
  suggestions: Suggestion[];
  onClose: () => void;
  onGoTo: (target: AtsIssue['target']) => void;
};

export const FixWizard = ({ resumeId, suggestions, onClose, onGoTo }: Props) => {
  const { store, updateResume } = useResumeStore();
  const resume = store.resumes.find((candidate) => candidate.id === resumeId);
  const [steps] = useState(() => (resume ? buildSteps(resume, suggestions) : []));
  const [index, setIndex] = useState(0);
  const [startScore] = useState(() => (resume ? analyzeResume(resume).score : 0));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const report = useMemo(() => (resume ? analyzeResume(resume) : null), [resume]);
  if (!resume || !report) return null;

  // Skip steps that no longer apply (e.g. the placeholder step when there are none left).
  const isRelevant = (step: Step) => {
    if (step.kind === 'placeholders') return PLACEHOLDER.test(JSON.stringify(resume.sections));
    if (step.kind === 'contact') return report.issues.some((issue) => issue.id.startsWith('contact-'));
    if (step.kind === 'dates') return report.issues.some((issue) => issue.id === 'structure-dates');
    if (step.kind === 'manual') return report.issues.some((issue) => issue.id === step.issue.id);
    return true;
  };

  const next = () => {
    let target = index + 1;
    while (target < steps.length && !isRelevant(steps[target])) target++;
    setIndex(target);
  };
  const update = (updater: (resume: Resume) => Resume) => updateResume(resumeId, updater);
  const step = steps[index];
  const done = index >= steps.length;
  const visibleTotal = steps.filter((candidate, candidateIndex) => candidateIndex < index || isRelevant(candidate)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('Fix your resume step by step')}
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-4">
          <ScoreRing score={report.score} size={52} />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-slate-900">
              {done ? t('All done') : t('Step {n} of {total}', { n: Math.min(index + 1, visibleTotal), total: visibleTotal })}
            </div>
            <div className="text-[13px] text-slate-500">
              {t('ATS score')} {startScore} → <span className="font-semibold text-slate-900">{report.score}</span> · {scoreLabel(report.score)}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(Math.min(index, visibleTotal) / Math.max(1, visibleTotal)) * 100}%` }} />
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Close')} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Icon name="x" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {done || !step ? (
            <FinishedStep score={report.score} start={startScore} remaining={report.issues.filter((issue) => issue.points > 0)} onGoTo={(target) => { onClose(); onGoTo(target); }} />
          ) : step.kind === 'suggestion' ? (
            <SuggestionStep key={step.id} resume={resume} suggestion={step.suggestion} onApply={(text, skills) => { update((current) => applySuggestion(current, { ...step.suggestion, text }, skills)); next(); }} onSkip={next} />
          ) : step.kind === 'contact' ? (
            <ContactStep key={step.id} personal={resume.personal} onSave={(personal) => { update((current) => ({ ...current, personal })); next(); }} onSkip={next} />
          ) : step.kind === 'dates' ? (
            <DatesStep key={step.id} resume={resume} onSave={(updated) => { update(() => updated); next(); }} onSkip={next} />
          ) : step.kind === 'placeholders' ? (
            <PlaceholderStep key={step.id} resume={resume} onSave={(updated) => { update(() => updated); next(); }} onSkip={next} />
          ) : (
            <ManualStep key={step.id} issue={step.issue} onGoTo={() => { onClose(); onGoTo(step.issue.target); }} onSkip={next} />
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ steps ------------------------------ */

const StepHeader = ({ eyebrow, title, reason }: { eyebrow: string; title: string; reason?: string }) => (
  <div className="mb-4">
    <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{eyebrow}</div>
    <h3 className="mt-1 text-lg font-semibold text-slate-900">{title}</h3>
    {reason && <p className="mt-1 text-sm text-slate-600">{reason}</p>}
  </div>
);

const StepActions = ({ onPrimary, primaryLabel, onSkip, disabled }: { onPrimary: () => void; primaryLabel: string; onSkip: () => void; disabled?: boolean }) => (
  <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
    <Button variant="ghost" onClick={onSkip}>
      {t('Skip')}
    </Button>
    <Button variant="accent" icon="check" onClick={onPrimary} disabled={disabled}>
      {primaryLabel}
    </Button>
  </div>
);

const SuggestionStep = ({ resume, suggestion, onApply, onSkip }: { resume: Resume; suggestion: Suggestion; onApply: (text: string, skills?: string[]) => void; onSkip: () => void }) => {
  const [text, setText] = useState(suggestion.text);
  const isSkills = suggestion.type === 'skills_add' || suggestion.type === 'skills_confirm';
  const [chosen, setChosen] = useState<string[]>(suggestion.type === 'skills_add' ? suggestion.skills : []);
  const before = suggestionBefore(resume, suggestion);
  const label = suggestionLabel(resume, suggestion);

  if (isSkills) {
    return (
      <div>
        <StepHeader
          eyebrow={suggestion.type === 'skills_confirm' ? t('Confirm skills') : t('Add skills')}
          title={label}
          reason={suggestion.type === 'skills_confirm' ? t('The job ad asks for these. Tick only the ones you really have; honesty matters in interviews.') : suggestion.reason}
        />
        <div className="flex flex-wrap gap-2">
          {suggestion.skills.map((skill) => {
            const active = chosen.includes(skill);
            return (
              <button
                key={skill}
                type="button"
                aria-pressed={active}
                onClick={() => setChosen((current) => (active ? current.filter((item) => item !== skill) : [...current, skill]))}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 ring-inset transition ${active ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-700 ring-slate-300 hover:ring-slate-400'}`}
              >
                {active && <Icon name="check" className="h-3.5 w-3.5" />}
                {skill}
              </button>
            );
          })}
        </div>
        <StepActions onPrimary={() => onApply('', chosen)} primaryLabel={chosen.length ? t('Add {count} skill|Add {count} skills', { count: chosen.length }) : t('Add skills')} onSkip={onSkip} disabled={!chosen.length} />
      </div>
    );
  }

  return (
    <div>
      <StepHeader eyebrow={t('Claude suggests')} title={label} reason={suggestion.reason} />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('Now')}</div>
          <div className="min-h-[120px] whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-500">{before || <em>{t('Empty')}</em>}</div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-emerald-600">
            {t('Improved')} <span className="font-normal normal-case text-slate-400">{t('you can edit it')}</span>
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={Math.max(5, text.split('\n').length + 1)}
            className={`${inputClass} leading-relaxed ring-emerald-200`}
            aria-label={t('Improved text')}
          />
          {PLACEHOLDER.test(text) && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700">
              <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('Replace the [brackets] with your real numbers, here or in the last step.')}
            </p>
          )}
        </div>
      </div>
      <StepActions onPrimary={() => onApply(text)} primaryLabel={t('Use this')} onSkip={onSkip} disabled={!text.trim()} />
    </div>
  );
};

const CONTACT_FIELDS: { field: keyof PersonalInfo; label: string; placeholder: string; type?: string }[] = [
  { field: 'fullName', label: 'Full name', placeholder: 'Ana Marković' },
  { field: 'email', label: 'Email', placeholder: 'ana@example.com', type: 'email' },
  { field: 'phone', label: 'Phone', placeholder: '+381 64 123 4567', type: 'tel' },
  { field: 'location', label: 'City', placeholder: 'Beograd, Srbija' },
  { field: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/you' }
];

const ContactStep = ({ personal, onSave, onSkip }: { personal: PersonalInfo; onSave: (personal: PersonalInfo) => void; onSkip: () => void }) => {
  const [draft, setDraft] = useState(personal);
  const missing = CONTACT_FIELDS.filter(({ field }) => !String(personal[field] ?? '').trim());
  return (
    <div>
      <StepHeader eyebrow={t('Only you can fill this in')} title={t('Complete your contact details')} reason={t('Recruiters and ATS systems need a way to reach you.')} />
      <div className="grid gap-3 sm:grid-cols-2">
        {missing.map(({ field, label, placeholder, type }) => (
          <TextField key={field} label={t(label)} type={type} placeholder={placeholder} value={String(draft[field] ?? '')} onChange={(value) => setDraft((current) => ({ ...current, [field]: value }))} />
        ))}
      </div>
      <StepActions onPrimary={() => onSave(draft)} primaryLabel={t('Save')} onSkip={onSkip} />
    </div>
  );
};

const DatesStep = ({ resume, onSave, onSkip }: { resume: Resume; onSave: (resume: Resume) => void; onSkip: () => void }) => {
  const [draft, setDraft] = useState(resume);
  const entries = draft.sections
    .filter((section): section is EntriesSection => section.type === 'entries' && !section.hidden && ['experience', 'internships', 'projects', 'volunteering'].includes(section.kind))
    .flatMap((section) => section.items.filter((item) => (item.title || item.subtitle) && !resume.sections.some((s) => s.type === 'entries' && s.items.some((original) => original.id === item.id && (original.start || original.end)))).map((item) => ({ section, item })));
  const set = (sectionId: string, itemId: string, field: 'start' | 'end', value: string) =>
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId && section.type === 'entries' ? { ...section, items: section.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)) } : section
      )
    }));
  return (
    <div>
      <StepHeader eyebrow={t('Only you can fill this in')} title={t('Add dates to your experience')} reason={t('ATS systems calculate your years of experience from dates. Use a format like "Mar 2022" and "Present".')} />
      <div className="space-y-3">
        {entries.map(({ section, item }) => (
          <div key={item.id} className="grid items-end gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_120px_120px]">
            <div className="text-sm">
              <div className="font-medium text-slate-900">{item.title || item.subtitle}</div>
              <div className="text-slate-500">{item.subtitle}</div>
            </div>
            <TextField label={t('Start')} value={item.start} onChange={(value) => set(section.id, item.id, 'start', value)} placeholder={t('Mar 2022')} />
            <TextField label={t('End')} value={item.end} onChange={(value) => set(section.id, item.id, 'end', value)} placeholder={t('Present')} />
          </div>
        ))}
      </div>
      <StepActions onPrimary={() => onSave(draft)} primaryLabel={t('Save dates')} onSkip={onSkip} />
    </div>
  );
};

const PlaceholderStep = ({ resume, onSave, onSkip }: { resume: Resume; onSave: (resume: Resume) => void; onSkip: () => void }) => {
  const lines = useMemo(
    () =>
      resume.sections.flatMap((section) => {
        if (section.type === 'text')
          return section.text.split('\n').map((line, lineIndex) => ({ key: `${section.id}:${lineIndex}`, label: section.title, line, sectionId: section.id, itemId: '', lineIndex })).filter((entry) => PLACEHOLDER.test(entry.line));
        if (section.type !== 'entries') return [];
        return section.items.flatMap((item) =>
          item.description
            .split('\n')
            .map((line, lineIndex) => ({ key: `${item.id}:${lineIndex}`, label: [item.title, item.subtitle].filter(Boolean).join(' · '), line, sectionId: section.id, itemId: item.id, lineIndex }))
            .filter((entry) => PLACEHOLDER.test(entry.line))
        );
      }),
    [resume]
  );
  const [edits, setEdits] = useState<Record<string, string>>({});
  const stillOpen = lines.filter((entry) => PLACEHOLDER.test(edits[entry.key] ?? entry.line)).length;

  const save = () => {
    const replaceLine = (text: string, lineIndex: number, value: string) =>
      text
        .split('\n')
        .map((line, index) => (index === lineIndex ? value : line))
        .filter((line, index) => index !== lineIndex || line.trim().replace(/^[-•]\s*$/, ''))
        .join('\n');
    let updated = resume;
    for (const entry of lines) {
      const value = edits[entry.key];
      if (value === undefined) continue;
      updated = {
        ...updated,
        sections: updated.sections.map((section) => {
          if (section.id !== entry.sectionId) return section;
          if (section.type === 'text') return { ...section, text: replaceLine(section.text, entry.lineIndex, value) };
          if (section.type === 'entries') return { ...section, items: section.items.map((item) => (item.id === entry.itemId ? { ...item, description: replaceLine(item.description, entry.lineIndex, value) } : item)) };
          return section;
        })
      };
    }
    onSave(updated);
  };

  return (
    <div>
      <StepHeader
        eyebrow={t('Only you know these numbers')}
        title={t('Fill in {count} placeholder|Fill in {count} placeholders', { count: lines.length })}
        reason={t("Replace each [bracket] with your real number. If you don't know it, rewrite the sentence without it or clear the line.")}
      />
      <div className="space-y-3">
        {lines.map((entry) => {
          const value = edits[entry.key] ?? entry.line;
          const open = PLACEHOLDER.test(value);
          return (
            <div key={entry.key}>
              <div className="mb-1 text-xs font-medium text-slate-500">{entry.label}</div>
              <textarea
                rows={2}
                value={value}
                onChange={(event) => setEdits((current) => ({ ...current, [entry.key]: event.target.value }))}
                className={`${inputClass} ${open ? 'ring-amber-300' : 'ring-emerald-300'}`}
                aria-label={`Edit: ${entry.label}`}
              />
            </div>
          );
        })}
      </div>
      <StepActions onPrimary={save} primaryLabel={stillOpen ? t('Save ({n} left)', { n: stillOpen }) : t('Save')} onSkip={onSkip} />
    </div>
  );
};

const ManualStep = ({ issue, onGoTo, onSkip }: { issue: AtsIssue; onGoTo: () => void; onSkip: () => void }) => (
  <div>
    <StepHeader eyebrow={t('Needs your input')} title={issue.title} reason={issue.detail} />
    <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
      <Button variant="ghost" onClick={onSkip}>
        {t('Skip')}
      </Button>
      <Button variant="accent" iconRight="chevronRight" onClick={onGoTo}>
        {t('Take me there')}
      </Button>
    </div>
  </div>
);

const FinishedStep = ({ score, start, remaining, onGoTo }: { score: number; start: number; remaining: AtsIssue[]; onGoTo: (target: AtsIssue['target']) => void }) => (
  <div className="py-4 text-center">
    <div className="mx-auto w-fit">
      <ScoreRing score={score} size={120} />
    </div>
    <h3 className="mt-4 text-xl font-semibold text-slate-900">
      {score >= 95 ? t('Your resume is ATS-ready') : score > start ? t('Up from {start} to {score}', { start, score }) : t('Review finished')}
    </h3>
    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
      {score >= 95 ? t('It reads well for both ATS systems and recruiters. Download the PDF and apply.') : t('A few things still need your input. They are listed below.')}
    </p>
    {remaining.length > 0 && (
      <ul className="mx-auto mt-5 max-w-lg space-y-2 text-left">
        {remaining.slice(0, 6).map((issue) => (
          <li key={issue.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block font-medium text-slate-800">{issue.title}</span>
              <span className="block truncate text-xs text-slate-500">{issue.detail}</span>
            </span>
            {issue.target && (
              <Button size="sm" onClick={() => onGoTo(issue.target)}>
                {t('Fix')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    )}
  </div>
);
