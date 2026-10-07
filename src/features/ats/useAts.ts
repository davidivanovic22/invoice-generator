import { useCallback, useRef, useState } from 'react';
import { t } from '../../i18n';
import type { Resume } from '../resumes/model';
import { useResumeStore } from '../resumes/store';
import { analyzeResume } from './analyze';
import type { Suggestion } from './ai';

export const TARGET_SCORE = 95;
const MAX_ROUNDS = 3;

const loadAi = () => import('./ai');

const keywordsStale = (resume: Resume) =>
  Boolean(resume.ats.jobDescription.trim()) && resume.ats.keywordsSource.trim() !== resume.ats.jobDescription.trim();

export type AtsBusy = { label: string; round?: number } | null;

/**
 * AI flows for one resume. Every step writes to the store as it goes, so the
 * preview and score update live, and a snapshot allows undoing the whole run.
 */
export const useAts = (resumeId: string) => {
  const { updateResume, getResume } = useResumeStore();
  const [busy, setBusy] = useState<AtsBusy>(null);
  const [assessment, setAssessment] = useState('');
  const [undoSnapshot, setUndoSnapshot] = useState<Resume | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const save = useCallback(
    (resume: Resume) => {
      updateResume(resumeId, () => resume);
      return resume;
    },
    [resumeId, updateResume]
  );

  /** Refreshes Eden AI's keyword list when the job ad changed. Returns the updated resume. */
  const refreshKeywords = useCallback(
    async (resume: Resume, signal?: AbortSignal): Promise<Resume> => {
      if (!keywordsStale(resume)) return resume;
      const { extractJobKeywords } = await loadAi();
      const result = await extractJobKeywords(resume, resume.ats.jobDescription, signal);
      setAssessment(result.assessment);
      return save({ ...resume, ats: { ...resume.ats, keywords: result.keywords, keywordsSource: resume.ats.jobDescription } });
    },
    [save]
  );

  const run = useCallback(async <T,>(task: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      return await task(controller.signal);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(null);
    }
  }, []);

  const analyzeJob = useCallback(
    () =>
      run(async (signal) => {
        const resume = getResume(resumeId);
        if (!resume) return;
        setBusy({ label: t('Reading the job ad…') });
        await refreshKeywords({ ...resume, ats: { ...resume.ats, keywordsSource: '' } }, signal);
      }),
    [getResume, refreshKeywords, resumeId, run]
  );

  /** Proposals for the step-by-step wizard; nothing is applied. */
  const getSuggestions = useCallback(
    () =>
      run(async (signal): Promise<Suggestion[]> => {
        let resume = getResume(resumeId);
        if (!resume) return [];
        setBusy({ label: t('Reading the job ad…') });
        resume = await refreshKeywords(resume, signal);
        setBusy({ label: t('Eden AI is reviewing your resume…') });
        const { suggestImprovements } = await loadAi();
        return suggestImprovements(resume, analyzeResume(resume), signal);
      }),
    [getResume, refreshKeywords, resumeId, run]
  );

  /**
   * Applies Eden AI's rewrites automatically, re-scores, and repeats until the
   * target is reached or nothing more can be improved without the user.
   * Returns what still needs the user: skills to confirm.
   */
  const autoImprove = useCallback(
    () =>
      run(async (signal) => {
        let resume = getResume(resumeId);
        if (!resume) return { pendingSkills: [] as Suggestion[], before: 0, after: 0 };
        const before = analyzeResume(resume).score;
        setUndoSnapshot(resume);
        setBusy({ label: t('Reading the job ad…') });
        resume = await refreshKeywords(resume, signal);
        const { suggestImprovements, applySuggestion } = await loadAi();
        const pendingSkills: Suggestion[] = [];

        for (let round = 1; round <= MAX_ROUNDS; round++) {
          const report = analyzeResume(resume);
          if (report.score >= TARGET_SCORE && !report.issues.some((issue) => issue.aiFixable && issue.points > 0)) break;
          setBusy({ label: round === 1 ? t('Rewriting your resume…') : t('Polishing the remaining issues…'), round });
          const suggestions = await suggestImprovements(resume, report, signal);
          const automatic = suggestions.filter((suggestion) => suggestion.type !== 'skills_confirm');
          pendingSkills.push(...suggestions.filter((suggestion) => suggestion.type === 'skills_confirm' && suggestion.skills.length));
          if (automatic.length === 0) break;
          for (const suggestion of automatic) resume = applySuggestion(resume, suggestion);
          save(resume);
          // Another round only helps if this one did; what's left needs the user (numbers, facts).
          if (analyzeResume(resume).score <= report.score) break;
        }
        // Several rounds can ask about the same skills: merge them into one step, minus ones already listed.
        const listed = new Set(
          resume.sections.flatMap((section) => (section.kind === 'skills' && section.type === 'tags' ? section.items.map((item) => item.toLowerCase()) : []))
        );
        const skills = Array.from(new Set(pendingSkills.flatMap((suggestion) => suggestion.skills))).filter((skill) => !listed.has(skill.toLowerCase()));
        const merged: Suggestion[] = skills.length
          ? [{ ...pendingSkills[0], skills }]
          : [];
        return { pendingSkills: merged, before, after: analyzeResume(resume).score };
      }),
    [getResume, refreshKeywords, resumeId, run, save]
  );

  const undo = useCallback(() => {
    if (!undoSnapshot) return;
    save(undoSnapshot);
    setUndoSnapshot(null);
  }, [save, undoSnapshot]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setBusy(null);
  }, []);

  return { busy, assessment, analyzeJob, getSuggestions, autoImprove, undo, canUndo: Boolean(undoSnapshot), cancel };
};
