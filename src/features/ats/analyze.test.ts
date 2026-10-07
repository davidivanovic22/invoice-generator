import { createEmptyResume, createSampleResume, type EntriesSection, type Resume } from '../resumes/model';
import { analyzeResume, containsKeyword, extractKeywordsHeuristic } from './analyze';

const withExperienceText = (resume: Resume, description: string): Resume => ({
  ...resume,
  sections: resume.sections.map((section) =>
    section.kind === 'experience' && section.type === 'entries'
      ? { ...section, items: section.items.map((item, index) => (index === 0 ? { ...item, description } : item)) }
      : section
  )
});

describe('analyzeResume', () => {
  it('scores an empty resume low and explains what is missing', () => {
    const report = analyzeResume(createEmptyResume());
    expect(report.score).toBeLessThan(25);
    const titles = report.issues.map((issue) => issue.title);
    expect(titles).toEqual(expect.arrayContaining(['Add your full name', 'Add a valid email address', 'Add your work experience']));
    expect(report.issues[0].severity).toBe('critical');
  });

  it('scores the well-written example resume highly', () => {
    const report = analyzeResume(createSampleResume());
    expect(report.score).toBeGreaterThanOrEqual(85);
    expect(report.categories.find((category) => category.id === 'keywords')).toBeUndefined();
  });

  it('flags placeholders as critical until they are filled in', () => {
    const report = analyzeResume(withExperienceText(createSampleResume(), '- Cut page load time by [X]%\n- Led a team of 5'));
    const issue = report.issues.find((item) => item.id === 'readability-placeholders');
    expect(issue?.severity).toBe('critical');
  });

  it('rewards quantified bullets that start with action verbs', () => {
    const weak = analyzeResume(withExperienceText(createSampleResume(), '- I was responsible for the website\n- Worked on various tasks'));
    const strong = analyzeResume(withExperienceText(createSampleResume(), '- Led a team of 6 engineers\n- Reduced costs by 30%\n- Shipped 12 releases'));
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(weak.issues.map((issue) => issue.id)).toEqual(expect.arrayContaining(['impact-weak', 'impact-first-person']));
  });

  it('measures keyword coverage against Eden AI keywords for the current job ad', () => {
    const resume = createSampleResume();
    const jobDescription = 'We need a Product Designer with Figma, design systems and Webflow experience.';
    resume.ats = { jobDescription, keywords: ['Figma', 'Design systems', 'Webflow', 'User research'], keywordsSource: jobDescription };
    const report = analyzeResume(resume);
    expect(report.keywords.source).toBe('ai');
    expect(report.keywords.missing).toEqual(['Webflow']);
    expect(report.keywords.matched).toHaveLength(3);
  });

  it('ignores Eden AI keywords that belong to an older job ad', () => {
    const resume = createSampleResume();
    resume.ats = { jobDescription: 'New ad mentioning Kubernetes and Kubernetes clusters', keywords: ['Figma'], keywordsSource: 'old ad' };
    expect(analyzeResume(resume).keywords.source).toBe('job');
  });

  it('asks for dates on experience entries without them', () => {
    const resume = createSampleResume();
    const experience = resume.sections.find((section) => section.kind === 'experience') as EntriesSection;
    experience.items[0] = { ...experience.items[0], start: '', end: '' };
    expect(analyzeResume(resume).issues.some((issue) => issue.id === 'structure-dates')).toBe(true);
  });
});

describe('keyword helpers', () => {
  it('matches keywords on word boundaries, tolerating plurals and .js', () => {
    const text = ' built apis in node.js and react, managed stakeholders ';
    expect(containsKeyword(text, 'Node.js')).toBe(true);
    expect(containsKeyword(text, 'API')).toBe(true);
    expect(containsKeyword(text, 'stakeholder')).toBe(true);
    expect(containsKeyword(text, 'Java')).toBe(false);
  });

  it('extracts repeated and technical terms from a job ad', () => {
    const keywords = extractKeywordsHeuristic(
      'Senior React Developer. You will build React apps with TypeScript and GraphQL. TypeScript is a must; GraphQL experience is a plus. Mentoring juniors, mentoring interns.'
    );
    expect(keywords).toEqual(expect.arrayContaining(['React', 'TypeScript', 'GraphQL']));
  });
});
