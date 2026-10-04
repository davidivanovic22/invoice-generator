import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { z } from 'zod';
import { createId } from '../../lib/files';
import { AI_MODEL, AiError, getClient, toAiError } from '../ai/client';
import {
  createDesign,
  createEntry,
  createPersonal,
  createSection,
  createAts,
  SECTION_KINDS,
  type Resume,
  type ResumeSection,
  type SectionKind
} from '../resumes/model';
import type { AtsReport } from './analyze';

/* ------------------------------ shared ------------------------------ */

type Effort = 'low' | 'medium' | 'high';

/**
 * One structured call. `fallbacks: "default"` lets the API retry on another
 * model if a safety classifier declines, instead of failing the request.
 */
const callStructured = async <T extends z.ZodType>(options: {
  schema: T;
  system: string;
  content: BetaContentBlockParam[];
  effort: Effort;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<z.infer<T>> => {
  const client = await getClient();
  try {
    const response = await client.beta.messages.parse(
      {
        model: AI_MODEL,
        max_tokens: options.maxTokens ?? 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: options.system,
        output_config: { effort: options.effort, format: betaZodOutputFormat(options.schema) },
        messages: [{ role: 'user', content: options.content }]
      },
      { signal: options.signal }
    );
    if (response.stop_reason === 'refusal') throw new AiError('refusal', 'Claude declined this request. Try rephrasing the text.');
    if (response.stop_reason === 'max_tokens') throw new AiError('invalid', 'The resume is too long to process in one go. Try shortening it.');
    if (!response.parsed_output) throw new AiError('invalid', 'Claude returned an unexpected answer. Please try again.');
    return response.parsed_output as z.infer<T>;
  } catch (error) {
    throw toAiError(error);
  }
};

const LANGUAGE_RULE = 'Write in the same language as the resume (if it is in Serbian, answer in Serbian; if English, in English).';

/** A compact, id-annotated view of the resume for prompts. */
const resumeForPrompt = (resume: Resume) => ({
  personal: { fullName: resume.personal.fullName, headline: resume.personal.headline, location: resume.personal.location },
  sections: resume.sections
    .filter((section) => !section.hidden)
    .map((section) => {
      const base = { sectionId: section.id, kind: section.kind, title: section.title };
      if (section.type === 'text') return { ...base, text: section.text };
      if (section.type === 'tags') return { ...base, items: section.items };
      if (section.type === 'languages') return { ...base, items: section.items.map((item) => `${item.name} (${item.level})`) };
      return {
        ...base,
        entries: section.items.map((item) => ({
          itemId: item.id,
          title: item.title,
          subtitle: item.subtitle,
          dates: [item.start, item.end].filter(Boolean).join(' – '),
          description: item.description
        }))
      };
    })
});

/* ------------------------------ job keywords ------------------------------ */

const KeywordsSchema = z.object({
  roleTitle: z.string().describe('The job title the ad is hiring for'),
  keywords: z
    .array(z.string())
    .describe('15-30 keywords an ATS would screen for: hard skills, tools, technologies, certifications, methods and key responsibilities, each as it is written in the ad (short, 1-3 words)'),
  assessment: z.string().describe('2-3 sentences: how well the resume fits this job and the single most important thing to improve')
});

export type JobKeywords = z.infer<typeof KeywordsSchema>;

export const extractJobKeywords = (resume: Resume, jobDescription: string, signal?: AbortSignal) =>
  callStructured({
    schema: KeywordsSchema,
    effort: 'medium',
    maxTokens: 4000,
    signal,
    system:
      'You are an ATS (applicant tracking system) expert. Extract the keywords a recruiter\'s ATS would screen for in this job ad, ordered by importance. Use the exact wording of the ad so string matching works. Skip generic words (team player, motivated) unless the ad stresses them.',
    content: [
      { type: 'text', text: `<job_ad>\n${jobDescription}\n</job_ad>` },
      { type: 'text', text: `<resume>\n${JSON.stringify(resumeForPrompt(resume))}\n</resume>` }
    ]
  });

/* ------------------------------ improvements ------------------------------ */

const SuggestionSchema = z.object({
  type: z
    .enum(['headline', 'summary', 'entry_description', 'skills_add', 'skills_confirm'])
    .describe(
      'headline: new job title under the name. summary: new profile text. entry_description: new bullet points for one entry. skills_add: skills clearly shown elsewhere in the resume but missing from the skills list. skills_confirm: important job-ad skills the resume does not prove; the user must confirm they have them.'
    ),
  sectionId: z.string().describe('sectionId from the input, or "" for headline / a new summary'),
  itemId: z.string().describe('itemId of the entry for entry_description, otherwise ""'),
  reason: z.string().describe('One short sentence for the user: what this change fixes'),
  text: z.string().describe('The complete new text. For entry_description: every bullet on its own line starting with "- ". Empty for skills suggestions.'),
  skills: z.array(z.string()).describe('Skills for skills_add / skills_confirm, otherwise empty')
});

const ImproveSchema = z.object({ suggestions: z.array(SuggestionSchema) });
export type Suggestion = z.infer<typeof SuggestionSchema>;

const IMPROVE_SYSTEM = `You are a senior resume writer and ATS optimisation expert. Rewrite parts of the resume so it scores 95-100% in an ATS check and reads well to a recruiter.

Rules - follow all of them:
1. Never invent facts. Do not add employers, job titles, dates, degrees, certifications, tools or numbers that are not in the resume.
2. When a bullet would be much stronger with a metric you do not have, insert one short placeholder in square brackets, such as [X%] or [N users]. The user will fill it in. Use placeholders sparingly: only where a real number very likely exists.
3. Bullet points: start with a strong action verb (past tense for past roles, present tense for a current role), keep each under about 25 words, 3-6 per role, focus on results and scope rather than duties. No "I", "my", "responsible for", "worked on".
4. Profile summary: 2-3 sentences, 30-80 words, name the target role and years of experience if known, and the strongest relevant skills.
5. Use job-ad keywords naturally, but only where the resume supports them. Put unproven ones in a skills_confirm suggestion instead.
6. ${LANGUAGE_RULE}
7. Copy sectionId and itemId exactly from the input. Return one suggestion per entry at most, and only for things that actually improve the resume. Skip parts that are already strong.`;

export const suggestImprovements = (resume: Resume, report: AtsReport, signal?: AbortSignal) =>
  callStructured({
    schema: ImproveSchema,
    effort: 'high',
    signal,
    system: IMPROVE_SYSTEM,
    content: [
      { type: 'text', text: `<resume>\n${JSON.stringify(resumeForPrompt(resume))}\n</resume>` },
      ...(resume.ats.jobDescription.trim()
        ? [{ type: 'text' as const, text: `<job_ad>\n${resume.ats.jobDescription}\n</job_ad>\n<missing_keywords>${report.keywords.missing.join(', ')}</missing_keywords>` }]
        : []),
      {
        type: 'text',
        text: `<ats_findings score="${report.score}">\n${report.issues
          .filter((issue) => issue.aiFixable)
          .map((issue) => `- ${issue.title}: ${issue.detail}`)
          .join('\n')}\n</ats_findings>\nPropose the changes that raise this resume to 95-100%.`
      }
    ]
  }).then((result) => result.suggestions);

/** Applies one suggestion to a resume; returns the resume unchanged if the target no longer exists. */
export const applySuggestion = (resume: Resume, suggestion: Suggestion, chosenSkills?: string[]): Resume => {
  switch (suggestion.type) {
    case 'headline':
      return { ...resume, personal: { ...resume.personal, headline: suggestion.text.trim() } };
    case 'summary': {
      const existing = resume.sections.find((section) => section.id === suggestion.sectionId && section.type === 'text') ?? resume.sections.find((section) => section.kind === 'summary');
      if (existing) return { ...resume, sections: resume.sections.map((section) => (section.id === existing.id && section.type === 'text' ? { ...section, text: suggestion.text.trim(), hidden: false } : section)) };
      return { ...resume, sections: [createSection('summary', { text: suggestion.text.trim() }), ...resume.sections] };
    }
    case 'entry_description':
      return {
        ...resume,
        sections: resume.sections.map((section) =>
          section.id === suggestion.sectionId && section.type === 'entries'
            ? { ...section, items: section.items.map((item) => (item.id === suggestion.itemId ? { ...item, description: suggestion.text.trim() } : item)) }
            : section
        )
      };
    case 'skills_add':
    case 'skills_confirm': {
      const skills = chosenSkills ?? suggestion.skills;
      if (!skills.length) return resume;
      const target = resume.sections.find((section) => section.kind === 'skills' && section.type === 'tags');
      if (target && target.type === 'tags') {
        const existing = new Set(target.items.map((item) => item.toLowerCase()));
        const additions = skills.filter((skill) => !existing.has(skill.toLowerCase()));
        return { ...resume, sections: resume.sections.map((section) => (section.id === target.id ? { ...target, items: [...target.items, ...additions], hidden: false } : section)) };
      }
      return { ...resume, sections: [...resume.sections, createSection('skills', { items: skills })] };
    }
    default:
      return resume;
  }
};

/** The text a suggestion replaces, for before/after display. */
export const suggestionBefore = (resume: Resume, suggestion: Suggestion): string => {
  if (suggestion.type === 'headline') return resume.personal.headline;
  const section = resume.sections.find((candidate) => candidate.id === suggestion.sectionId);
  if (suggestion.type === 'summary') {
    const summary = section ?? resume.sections.find((candidate) => candidate.kind === 'summary');
    return summary?.type === 'text' ? summary.text : '';
  }
  if (suggestion.type === 'entry_description' && section?.type === 'entries') return section.items.find((item) => item.id === suggestion.itemId)?.description ?? '';
  return '';
};

export const suggestionLabel = (resume: Resume, suggestion: Suggestion): string => {
  if (suggestion.type === 'headline') return 'Job title';
  if (suggestion.type === 'summary') return 'Profile summary';
  if (suggestion.type === 'skills_add') return 'Skills you already show';
  if (suggestion.type === 'skills_confirm') return 'Skills from the job ad';
  const section = resume.sections.find((candidate) => candidate.id === suggestion.sectionId);
  const item = section?.type === 'entries' ? section.items.find((candidate) => candidate.id === suggestion.itemId) : undefined;
  return item ? [item.title, item.subtitle].filter(Boolean).join(' · ') : 'Experience';
};

/* ------------------------------ import ------------------------------ */

const IMPORT_KINDS = Object.keys(SECTION_KINDS) as [SectionKind, ...SectionKind[]];

const ImportSchema = z.object({
  personal: z.object({
    fullName: z.string(),
    headline: z.string().describe('Current or target job title'),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    website: z.string(),
    linkedin: z.string(),
    github: z.string(),
    extras: z.array(z.object({ label: z.string(), value: z.string() })).describe('Other personal details such as date of birth or driving licence')
  }),
  sections: z.array(
    z.object({
      kind: z.enum(IMPORT_KINDS).describe('summary=profile text; skills and interests=tag lists; languages; everything with dated items=entries kinds; custom=anything else'),
      title: z.string().describe('The section title as written in the resume'),
      text: z.string().describe('For summary/custom sections: the text. Otherwise ""'),
      tags: z.array(z.string()).describe('For skills/interests: individual items'),
      languages: z.array(z.object({ name: z.string(), level: z.string() })),
      entries: z
        .array(
          z.object({
            title: z.string().describe('Job title, degree, project or certificate name'),
            subtitle: z.string().describe('Company, school, issuer'),
            location: z.string(),
            start: z.string().describe('As written, e.g. "Mar 2021" or "2019"'),
            end: z.string().describe('As written, or "Present"'),
            description: z.string().describe('Bullet points, one per line, each starting with "- "')
          })
        )
        .describe('For dated sections (experience, education, projects, certificates, courses, awards, volunteering, internships, references)')
    })
  )
});

const IMPORT_SYSTEM = `You convert resumes into structured data. Copy the content faithfully: keep the original wording, language, dates and order. Do not improve, summarise, translate or invent anything; a separate step handles improvements. Put each bullet point of a job on its own line starting with "- ". If something does not fit a field, put it in a custom section rather than dropping it.`;

export type ImportSource = { kind: 'pdf'; base64: string } | { kind: 'text'; text: string };

export const importResume = async (source: ImportSource, signal?: AbortSignal): Promise<Resume> => {
  const content: BetaContentBlockParam[] =
    source.kind === 'pdf'
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: source.base64 } },
          { type: 'text', text: 'Convert this resume into the structured format.' }
        ]
      : [{ type: 'text', text: `<resume>\n${source.text}\n</resume>\nConvert this resume into the structured format.` }];

  const parsed = await callStructured({ schema: ImportSchema, effort: 'medium', system: IMPORT_SYSTEM, content, signal });
  const now = new Date().toISOString();

  const sections: ResumeSection[] = parsed.sections
    .map((section): ResumeSection | null => {
      const info = SECTION_KINDS[section.kind] ?? SECTION_KINDS.custom;
      const title = section.title.trim() || info.title;
      if (info.type === 'text') return section.text.trim() ? createSection(section.kind, { title, text: section.text.trim() }) : null;
      if (info.type === 'tags') return section.tags.length ? createSection(section.kind, { title, items: section.tags }) : null;
      if (info.type === 'languages')
        return section.languages.length ? createSection('languages', { title, items: section.languages.map((item) => ({ id: createId(), ...item })) }) : null;
      return section.entries.length ? createSection(section.kind, { title, items: section.entries.map((entry) => createEntry(entry)) }) : null;
    })
    .filter((section): section is ResumeSection => section !== null);

  const name = parsed.personal.fullName.trim();
  return {
    id: createId(),
    name: name ? `${name} (imported)` : 'Imported resume',
    personal: createPersonal({ ...parsed.personal, extras: parsed.personal.extras.map((extra) => ({ id: createId(), ...extra })) }),
    sections,
    design: createDesign({ template: 'classic', font: 'serif' }),
    ats: createAts(),
    createdAt: now,
    updatedAt: now
  };
};
