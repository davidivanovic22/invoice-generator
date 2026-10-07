import { t } from '../../i18n';
import { SECTION_KINDS, type EntriesSection, type Resume, type ResumeSection } from '../resumes/model';

/**
 * Deterministic ATS score (0–100). It runs instantly, offline, and gives the
 * same answer every time, so "95+" means the same thing before and after an
 * AI pass. Eden AI's job is to fix what this finds, not to grade itself.
 */

export type CategoryId = 'contact' | 'structure' | 'impact' | 'summary' | 'skills' | 'readability' | 'keywords';
export type Severity = 'critical' | 'major' | 'minor';

export type AtsIssue = {
  id: string;
  category: CategoryId;
  severity: Severity;
  title: string;
  detail: string;
  /** Where to fix it, so the UI can jump there. */
  target?: { sectionId?: string; itemId?: string; field?: 'personal' };
  /** Eden AI can propose the fix (rewrites); otherwise only the user can (facts, numbers). */
  aiFixable: boolean;
  /** Score points this issue costs. */
  points: number;
};

export type AtsCategory = { id: CategoryId; label: string; score: number; max: number };

export type AtsReport = {
  score: number;
  categories: AtsCategory[];
  issues: AtsIssue[];
  keywords: { matched: string[]; missing: string[]; source: 'ai' | 'job' | 'none' };
  stats: { words: number; bullets: number; quantified: number; actionVerbs: number };
};

const CATEGORY_LABELS: Record<CategoryId, string> = {
  contact: 'Contact details',
  structure: 'Structure',
  impact: 'Achievements & impact',
  summary: 'Profile summary',
  skills: 'Skills',
  readability: 'Length & readability',
  keywords: 'Job keywords'
};

const MAX: Record<CategoryId, number> = { contact: 10, structure: 10, impact: 25, summary: 10, skills: 10, readability: 10, keywords: 25 };

/** Sections whose entries are expected to describe achievements as bullet points. */
const WORK_KINDS = new Set(['experience', 'internships', 'projects', 'volunteering']);

const ACTION_VERBS = new Set(
  `accelerated achieved acquired adapted addressed administered advanced advised advocated analyzed analysed applied architected arranged assembled assessed audited authored automated balanced boosted briefed budgeted built calculated championed changed chaired clarified coached collaborated combined communicated compiled completed composed computed conceived conceptualized conducted consolidated constructed consulted contributed controlled converted coordinated corrected counseled crafted created cultivated customized cut debugged decreased defined delegated delivered demonstrated deployed designed detected determined developed devised diagnosed digitized directed discovered doubled drafted drove earned edited educated eliminated enabled encouraged engineered enhanced ensured established estimated evaluated examined exceeded executed expanded expedited experimented explained facilitated fixed forecasted formalized formulated fostered founded gained generated grew guided halved handled headed helped hired identified implemented improved increased influenced initiated innovated inspected installed instituted integrated interviewed introduced invented investigated launched led leveraged lowered maintained managed mapped marketed maximized measured mentored merged migrated minimized modeled modernized monitored motivated negotiated onboarded operated optimized orchestrated organized originated overhauled oversaw owned partnered performed pioneered planned presented prioritized produced programmed promoted proposed prototyped provided published raised ran rebuilt recommended reconciled recruited redesigned reduced refactored refined reorganized replaced reported represented researched resolved restructured revamped reviewed revised saved scaled scheduled secured selected served shaped shipped simplified solved spearheaded standardized started steered streamlined strengthened structured succeeded supervised supported surpassed synthesized taught tested tracked trained transformed translated tripled troubleshot unified upgraded utilized validated verified won wrote`.split(
    /\s+/
  )
);
// Present-tense forms are right for a current role.
const toPast = (word: string) => {
  if (ACTION_VERBS.has(word)) return word;
  for (const candidate of [`${word}d`, `${word}ed`, word.replace(/s$/, 'ed'), word.replace(/s$/, 'd'), word.replace(/es$/, 'ed'), word.replace(/ies$/, 'ied'), word.replace(/y$/, 'ied')]) {
    if (ACTION_VERBS.has(candidate)) return candidate;
  }
  const irregular: Record<string, string> = { lead: 'led', leads: 'led', build: 'built', builds: 'built', run: 'ran', runs: 'ran', drive: 'drove', drives: 'drove', write: 'wrote', writes: 'wrote', grow: 'grew', grows: 'grew', win: 'won', oversee: 'oversaw', oversees: 'oversaw', teach: 'taught', cut: 'cut', own: 'owned', ship: 'shipped', ships: 'shipped' };
  return irregular[word] ?? null;
};

const WEAK_PHRASES = ['responsible for', 'worked on', 'duties included', 'tasked with', 'helped with', 'assisted with', 'involved in', 'participated in', 'various tasks', 'etc.'];
const PLACEHOLDER = /\[[^\]\n]{1,40}\]/;
const QUANTIFIED = /\d|%|€|\$|£/;

const STOPWORDS = new Set(
  `a about above across after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each either else ever every few for from further get got had has have having he her here hers him his how however i if in into is it its itself just least less like made make many may me might more most must my no nor not now of off often on once only or other our ours out over own per please rather same she should since so some such than that the their them then there these they this those though through to too under until up upon us very via was we well were what when where whether which while who whom why will with within without would yet you your yours able across ability candidate candidates experience experienced work working team teams role position job company year years including strong excellent good great new using use plus etc join looking ideal skills skill knowledge required requirements preferred responsibilities responsible opportunity offer benefits environment based within across day days high level`.split(
    /\s+/
  )
);

export const bulletLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-•*–]\s+/, ''));

const words = (text: string) => text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word));

export const resumePlainText = (resume: Resume) =>
  [
    resume.personal.fullName,
    resume.personal.headline,
    ...resume.sections
      .filter((section) => !section.hidden)
      .flatMap((section) => {
        if (section.type === 'text') return [section.title, section.text];
        if (section.type === 'tags') return [section.title, ...section.items];
        if (section.type === 'languages') return [section.title, ...section.items.map((item) => `${item.name} ${item.level}`)];
        return [section.title, ...section.items.flatMap((item) => [item.title, item.subtitle, item.location, item.description])];
      })
  ].join('\n');

const normalize = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/\.js\b/g, 'js')
    .replace(/[^\p{L}\p{N}+#.\s/-]/gu, ' ')
    .replace(/\s+/g, ' ')} `;

/** Case-insensitive whole-word match that tolerates plurals and "React.js" vs "React js". */
export const containsKeyword = (text: string, keyword: string) => {
  const haystack = normalize(text);
  const needle = normalize(keyword).trim();
  if (!needle) return true;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[\\s/(-])${escaped}(s|es)?(?=$|[\\s/,.;:)-])`, 'u').test(haystack);
};

/** A rough keyword list from a job ad, used until Eden AI extracts a better one. */
export const extractKeywordsHeuristic = (jobDescription: string, limit = 20): string[] => {
  const counts = new Map<string, { count: number; label: string }>();
  const bump = (label: string, weight = 1) => {
    const key = label.toLowerCase();
    const entry = counts.get(key) ?? { count: 0, label };
    entry.count += weight;
    counts.set(key, entry);
  };
  const tokens = jobDescription.split(/[\s,;:()•]+/).map((token) => token.replace(/^[^\p{L}\p{N}#.+]+|[^\p{L}\p{N}#+]+$/gu, ''));
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.length < 2 || STOPWORDS.has(token.toLowerCase()) || /^\d+$/.test(token)) continue;
    const technical = /[A-Z].*[A-Z]|[#+.]|\d/.test(token) || (/^[A-Z]/.test(token) && index > 0 && !/[.!?]$/.test(tokens[index - 1]));
    bump(token, technical ? 2 : 1);
    const next = tokens[index + 1];
    if (next && next.length > 2 && !STOPWORDS.has(next.toLowerCase())) bump(`${token} ${next}`, 0.75);
  }
  return Array.from(counts.values())
    .filter((entry) => entry.count >= 2)
    .sort((a, b) => b.count - a.count)
    .map((entry) => entry.label)
    .filter((label, index, all) => !all.slice(0, index).some((other) => other.toLowerCase().includes(label.toLowerCase())))
    .slice(0, limit);
};

const isEnglish = (text: string) => {
  const sample = words(text.toLowerCase());
  if (sample.length < 30) return true;
  const hits = sample.filter((word) => ['the', 'and', 'for', 'with', 'to', 'of', 'in'].includes(word)).length;
  return hits / sample.length > 0.03;
};

const visible = (resume: Resume) => resume.sections.filter((section) => !section.hidden);
const firstOfKind = (resume: Resume, kind: ResumeSection['kind']) => visible(resume).find((section) => section.kind === kind);

export const analyzeResume = (resume: Resume): AtsReport => {
  const issues: AtsIssue[] = [];
  const earned: Record<CategoryId, number> = { contact: 0, structure: 0, impact: 0, summary: 0, skills: 0, readability: 0, keywords: 0 };
  const add = (issue: AtsIssue) => issues.push(issue);
  const p = resume.personal;
  const text = resumePlainText(resume);

  /* ---------- contact ---------- */
  const contactChecks: [boolean, number, string, string][] = [
    [p.fullName.trim().length > 2, 3, t('Add your full name'), t('Recruiters and ATS systems need your name at the top.')],
    [/^\S+@\S+\.\S+$/.test(p.email.trim()), 3, t('Add a valid email address'), t('Without an email, an ATS cannot create your candidate profile.')],
    [p.phone.replace(/\D/g, '').length >= 6, 2, t('Add a phone number'), t('Most recruiters call before they email.')],
    [p.location.trim().length > 1, 1, t('Add your location'), t('City and country help with location filters (or write "Remote").')],
    [Boolean(p.linkedin.trim() || p.website.trim() || p.github.trim()), 1, t('Add LinkedIn or a portfolio link'), t('Recruiters almost always check LinkedIn.')]
  ];
  contactChecks.forEach(([ok, points, title, detail], index) => {
    if (ok) earned.contact += points;
    else add({ id: `contact-${index}`, category: 'contact', severity: points >= 3 ? 'critical' : 'minor', title, detail, target: { field: 'personal' }, aiFixable: false, points });
  });

  /* ---------- structure ---------- */
  const experience = firstOfKind(resume, 'experience') as EntriesSection | undefined;
  const education = firstOfKind(resume, 'education');
  const skills = visible(resume).filter((section) => section.kind === 'skills' && section.type === 'tags');
  const summarySection = firstOfKind(resume, 'summary');
  const workSections = visible(resume).filter((section): section is EntriesSection => section.type === 'entries' && WORK_KINDS.has(section.kind));
  const workEntries = workSections.flatMap((section) => section.items.filter((item) => item.title.trim() || item.subtitle.trim()).map((item) => ({ section, item })));

  if (experience && experience.items.some((item) => item.title.trim())) earned.structure += 4;
  else add({ id: 'structure-experience', category: 'structure', severity: 'critical', title: t('Add your work experience'), detail: t('ATS systems rank candidates mainly on experience. Add jobs, freelance work or internships.'), target: { sectionId: experience?.id }, aiFixable: false, points: 4 });
  if (education && (education.type !== 'entries' || education.items.length > 0)) earned.structure += 2;
  else add({ id: 'structure-education', category: 'structure', severity: 'major', title: t('Add an education section'), detail: t('Many ATS filters check for a degree or school, even when it is not required.'), target: { sectionId: education?.id }, aiFixable: false, points: 2 });
  if (skills.some((section) => section.type === 'tags' && section.items.length > 0)) earned.structure += 2;
  else add({ id: 'structure-skills', category: 'structure', severity: 'major', title: t('Add a skills section'), detail: t('A dedicated skills list is where ATS systems look for keywords first.'), aiFixable: true, points: 2 });
  if (p.headline.trim()) earned.structure += 1;
  else add({ id: 'structure-headline', category: 'structure', severity: 'major', title: t('Add a job title under your name'), detail: t('A headline like "Senior Frontend Developer" tells the ATS which role you match.'), target: { field: 'personal' }, aiFixable: true, points: 1 });

  const missingDates = workEntries.filter(({ item }) => !item.start.trim() && !item.end.trim());
  if (missingDates.length === 0) earned.structure += 1;
  else
    add({
      id: 'structure-dates',
      category: 'structure',
      severity: 'major',
      title: t('Add dates to {count} entry|Add dates to {count} entries', { count: missingDates.length }),
      detail: t('ATS systems calculate years of experience from dates. Missing: {list}.', { list: missingDates.map(({ item }) => item.title || item.subtitle).join(', ') }),
      target: { sectionId: missingDates[0].section.id, itemId: missingDates[0].item.id },
      aiFixable: false,
      points: 1
    });

  const unusual = visible(resume).filter((section) => section.kind !== 'custom' && section.title.trim().split(/\s+/).length > 3);
  if (unusual.length)
    add({
      id: 'structure-titles',
      category: 'structure',
      severity: 'minor',
      title: t('Use standard section titles'),
      detail: t('ATS parsers recognise titles like "Experience" or "Skills". Rename: {list}.', { list: unusual.map((section) => `"${section.title}"`).join(', ') }),
      target: { sectionId: unusual[0].id },
      aiFixable: false,
      points: 0
    });

  /* ---------- impact ---------- */
  const bullets = workEntries.flatMap(({ section, item }) => bulletLines(item.description).map((line) => ({ section, item, line })));
  const english = isEnglish(text);
  const quantified = bullets.filter((bullet) => QUANTIFIED.test(bullet.line) && !PLACEHOLDER.test(bullet.line));
  const actionCount = bullets.filter((bullet) => {
    const first = bullet.line.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';
    return Boolean(toPast(first));
  }).length;

  if (bullets.length === 0) {
    if (workEntries.length > 0)
      add({ id: 'impact-none', category: 'impact', severity: 'critical', title: t('Describe what you achieved in each job'), detail: t('Your experience has no descriptions. Add 3–5 bullet points per role, starting with a verb and including results.'), target: { sectionId: workEntries[0].section.id, itemId: workEntries[0].item.id }, aiFixable: true, points: MAX.impact });
  } else {
    const quantifiedRatio = quantified.length / bullets.length;
    const quantifiedPoints = 10 * Math.min(1, quantifiedRatio / 0.5);
    earned.impact += quantifiedPoints;
    if (quantifiedRatio < 0.5)
      add({
        id: 'impact-numbers',
        category: 'impact',
        severity: quantifiedRatio < 0.2 ? 'critical' : 'major',
        title: t('Add numbers to your achievements'),
        detail: t('Only {n} of {total} bullet points contain a number. Aim for at least half: team size, users, %, money, time saved.', { n: quantified.length, total: bullets.length }),
        target: { sectionId: bullets[0].section.id },
        aiFixable: true,
        points: Math.round(10 - quantifiedPoints)
      });

    if (english) {
      const actionRatio = actionCount / bullets.length;
      const actionPoints = 8 * Math.min(1, actionRatio / 0.8);
      earned.impact += actionPoints;
      if (actionRatio < 0.8)
        add({
          id: 'impact-verbs',
          category: 'impact',
          severity: 'major',
          title: t('Start bullet points with strong action verbs'),
          detail: t('{n} bullet points don\'t start with a verb like "Led", "Built" or "Reduced".', { n: bullets.length - actionCount }),
          target: { sectionId: bullets[0].section.id },
          aiFixable: true,
          points: Math.round(8 - actionPoints)
        });
    } else {
      earned.impact += 8;
    }

    const roles = workEntries.filter(({ section }) => section.kind === 'experience');
    const badRoles = roles.filter(({ item }) => {
      const count = bulletLines(item.description).length;
      return count < 2 || count > 7;
    });
    const rolePoints = roles.length ? 4 * (1 - badRoles.length / roles.length) : 4;
    earned.impact += rolePoints;
    if (badRoles.length)
      add({
        id: 'impact-bullet-count',
        category: 'impact',
        severity: 'minor',
        title: t('Use 2–6 bullet points per job'),
        detail: t('Adjust: {list}.', { list: badRoles.map(({ item }) => item.title || item.subtitle).join(', ') }),
        target: { sectionId: badRoles[0].section.id, itemId: badRoles[0].item.id },
        aiFixable: true,
        points: Math.round(4 - rolePoints)
      });

    const weak = bullets.filter((bullet) => WEAK_PHRASES.some((phrase) => bullet.line.toLowerCase().includes(phrase)));
    const firstPerson = bullets.filter((bullet) => /\b(I|me|my)\b/.test(bullet.line));
    const stylePoints = Math.max(0, 3 - weak.length - firstPerson.length);
    earned.impact += stylePoints;
    if (weak.length)
      add({ id: 'impact-weak', category: 'impact', severity: 'minor', title: t('Replace passive phrases'), detail: t('Phrases like "responsible for" or "worked on" describe duties, not results ({n} found).', { n: weak.length }), target: { sectionId: weak[0].section.id, itemId: weak[0].item.id }, aiFixable: true, points: Math.min(3, weak.length) });
    if (firstPerson.length)
      add({ id: 'impact-first-person', category: 'impact', severity: 'minor', title: t('Remove "I" and "my" from bullet points'), detail: t('Resume bullets are written without pronouns: "Led the team", not "I led the team".'), target: { sectionId: firstPerson[0].section.id, itemId: firstPerson[0].item.id }, aiFixable: true, points: Math.min(3, firstPerson.length) });
  }

  /* ---------- summary ---------- */
  const summaryText = summarySection?.type === 'text' ? summarySection.text.trim() : '';
  const summaryWords = words(summaryText).length;
  if (summaryText) {
    earned.summary += 4;
    if (summaryWords >= 25 && summaryWords <= 90) earned.summary += 3;
    else add({ id: 'summary-length', category: 'summary', severity: 'minor', title: summaryWords < 25 ? t('Expand your profile summary') : t('Shorten your profile summary'), detail: t('It has {n} words; 30–80 reads best.', { n: summaryWords }), target: { sectionId: summarySection?.id }, aiFixable: true, points: 3 });
    const headlineWords = words(p.headline.toLowerCase()).filter((word) => word.length > 3);
    if (headlineWords.length === 0 || headlineWords.some((word) => summaryText.toLowerCase().includes(word))) earned.summary += 3;
    else add({ id: 'summary-role', category: 'summary', severity: 'minor', title: t('Mention your target role in the summary'), detail: t('Name your role ("{role}") in the first sentence so it matches the job title.', { role: p.headline }), target: { sectionId: summarySection?.id }, aiFixable: true, points: 3 });
  } else {
    add({ id: 'summary-missing', category: 'summary', severity: 'major', title: t('Add a profile summary'), detail: t('2–3 sentences at the top: your role, years of experience and what you are best at. It is the first thing recruiters read.'), target: { sectionId: summarySection?.id }, aiFixable: true, points: MAX.summary });
  }

  /* ---------- skills ---------- */
  const skillCount = skills.reduce((sum, section) => sum + (section.type === 'tags' ? section.items.length : 0), 0);
  const skillPoints = skillCount === 0 ? 0 : skillCount < 5 ? 4 : skillCount < 8 ? 7 : skillCount <= 25 ? 10 : 7;
  earned.skills = skillPoints;
  if (skillPoints < 10 && skillCount > 0)
    add({
      id: 'skills-count',
      category: 'skills',
      severity: skillCount < 5 ? 'major' : 'minor',
      title: skillCount > 25 ? t('Trim your skills list') : t('List more skills'),
      detail:
        skillCount > 25
          ? t('{n} skills dilute the important ones. Keep the 10–20 most relevant.', { n: skillCount })
          : t('You list {n}. 8–20 specific skills (tools, technologies, methods) work best.', { n: skillCount }),
      target: { sectionId: skills[0]?.id },
      aiFixable: true,
      points: 10 - skillPoints
    });
  else if (skillCount === 0) earned.skills = 0;

  /* ---------- readability ---------- */
  const totalWords = words(text).length;
  if (totalWords >= 250 && totalWords <= 1100) earned.readability += 4;
  else add({ id: 'readability-length', category: 'readability', severity: totalWords < 150 ? 'major' : 'minor', title: totalWords < 250 ? t('Your resume is too short') : t('Your resume is too long'), detail: `${t('{n} words. Aim for 400–900 (one to two pages).', { n: totalWords })}${totalWords < 250 ? ` ${t('Describe each job in more detail: projects, tools and results.')}` : ''}`, target: { sectionId: experience?.id }, aiFixable: totalWords > 1100, points: 4 });
  const longBullets = bullets.filter((bullet) => words(bullet.line).length > 35);
  if (longBullets.length === 0) earned.readability += 3;
  else add({ id: 'readability-long-bullets', category: 'readability', severity: 'minor', title: t('Shorten long bullet points'), detail: t('{count} bullet point is over 35 words. Keep each to one or two lines.|{count} bullet points are over 35 words. Keep each to one or two lines.', { count: longBullets.length }), target: { sectionId: longBullets[0].section.id, itemId: longBullets[0].item.id }, aiFixable: true, points: 3 });
  const placeholders = (text.match(new RegExp(PLACEHOLDER.source, 'g')) ?? []).length;
  if (placeholders === 0) earned.readability += 3;
  else add({ id: 'readability-placeholders', category: 'readability', severity: 'critical', title: t('Fill in {count} placeholder like [X%]|Fill in {count} placeholders like [X%]', { count: placeholders }), detail: t('Replace each bracket with your real number, or remove it. Never send a resume with placeholders.'), aiFixable: false, points: 3 });

  /* ---------- keywords ---------- */
  const { ats } = resume;
  const aiKeywordsFresh = ats.keywords.length > 0 && ats.keywordsSource.trim() === ats.jobDescription.trim();
  const keywordList = aiKeywordsFresh ? ats.keywords : ats.jobDescription.trim() ? extractKeywordsHeuristic(ats.jobDescription) : [];
  const matched = keywordList.filter((keyword) => containsKeyword(text, keyword));
  const missing = keywordList.filter((keyword) => !containsKeyword(text, keyword));
  const hasKeywords = keywordList.length > 0;
  if (hasKeywords) {
    earned.keywords = MAX.keywords * (matched.length / keywordList.length);
    if (missing.length)
      add({
        id: 'keywords-missing',
        category: 'keywords',
        severity: matched.length / keywordList.length < 0.6 ? 'critical' : 'major',
        title: t('Missing {count} keyword from the job ad|Missing {count} keywords from the job ad', { count: missing.length }),
        detail: t('Add the ones that are true for you, in your skills or bullet points: {list}.', { list: `${missing.slice(0, 12).join(', ')}${missing.length > 12 ? '…' : ''}` }),
        aiFixable: true,
        points: Math.round(MAX.keywords - earned.keywords)
      });
  }

  /* ---------- formatting advice (not scored) ---------- */
  if (resume.design.template === 'creative' || resume.design.template === 'compact')
    add({ id: 'format-columns', category: 'structure', severity: 'minor', title: t('Consider a single-column template'), detail: t('Two-column layouts are fine for modern ATS systems, but older ones may read columns out of order. "Classic" is the safest choice.'), aiFixable: false, points: 0 });

  const categories = (Object.keys(MAX) as CategoryId[])
    .filter((id) => id !== 'keywords' || hasKeywords)
    .map((id) => ({ id, label: t(CATEGORY_LABELS[id]), score: Math.round(Math.min(MAX[id], earned[id]) * 10) / 10, max: MAX[id] }));
  const total = categories.reduce((sum, category) => sum + category.score, 0);
  const possible = categories.reduce((sum, category) => sum + category.max, 0);
  const severityRank: Record<Severity, number> = { critical: 0, major: 1, minor: 2 };

  return {
    score: Math.round((total / possible) * 100),
    categories,
    issues: issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.points - a.points),
    keywords: { matched, missing, source: aiKeywordsFresh ? 'ai' : hasKeywords ? 'job' : 'none' },
    stats: { words: totalWords, bullets: bullets.length, quantified: quantified.length, actionVerbs: actionCount }
  };
};

export const scoreLabel = (score: number) =>
  t(score >= 95 ? 'Excellent' : score >= 85 ? 'Very good' : score >= 70 ? 'Good' : score >= 50 ? 'Needs work' : 'Weak');

export const sectionTitle = (section: ResumeSection) => section.title || SECTION_KINDS[section.kind].title;
