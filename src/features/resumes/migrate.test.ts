import { LEGACY_RESUME_KEY, loadResumeStore, migrateLegacyResume, RESUME_STORE_KEY } from './migrate';

const legacy = {
  id: 'r1',
  personal: { fullName: 'David Ivanović', title: 'Full Stack Developer', email: 'd@example.com', address: 'Kragujevac', linkedin: 'linkedin.com/in/d', dateOfBirth: '1996-01-01' },
  professionalSummary: 'Full stack developer.',
  skills: [{ id: 's', name: 'Angular', percent: 90 }],
  qualities: [{ id: 'q', name: 'Teamwork', percent: 80 }],
  hobbies: ['Football'],
  experience: [{ id: 'e', company: 'Valamar', project: 'Maro CMS', location: 'Kragujevac', role: 'Developer', start: '2024', end: 'Present', bullets: ['Built the CMS', ''] }],
  education: [{ id: 'ed', school: 'Metropolitan', degree: 'BSc', start: '2018', end: '2022' }],
  languages: [{ id: 'l', name: 'English', level: 'B2' }],
  courses: [{ id: 'c', title: 'React', provider: 'Udemy', year: '2023' }],
  enabledSections: { courses: false },
  enabledPersonalFields: { linkedin: true, dateOfBirth: true },
  editorSettings: { template: 'executive-split', accentColor: '#ef4444' }
};

describe('migrateLegacyResume', () => {
  const resume = migrateLegacyResume(legacy);
  const kinds = resume.sections.map((section) => section.kind);

  it('keeps personal details and enabled extra fields', () => {
    expect(resume.personal).toMatchObject({ fullName: 'David Ivanović', headline: 'Full Stack Developer', location: 'Kragujevac', linkedin: 'linkedin.com/in/d' });
    expect(resume.personal.extras).toEqual([expect.objectContaining({ label: 'Date of birth', value: '1996-01-01' })]);
  });

  it('converts each old section into the new structure', () => {
    expect(kinds).toEqual(['summary', 'experience', 'education', 'skills', 'languages', 'courses', 'skills', 'interests']);
    const experience = resume.sections[1];
    expect(experience.type === 'entries' && experience.items[0]).toMatchObject({ title: 'Developer', subtitle: 'Valamar · Maro CMS', description: '- Built the CMS' });
  });

  it('keeps disabled sections but hides them', () => {
    expect(resume.sections.find((section) => section.kind === 'courses')?.hidden).toBe(true);
  });

  it('maps the old template and colour', () => {
    expect(resume.design).toMatchObject({ template: 'executive', accentColor: '#ef4444' });
  });
});

describe('loadResumeStore', () => {
  it('migrates the old key and keeps it as a backup', () => {
    localStorage.setItem(LEGACY_RESUME_KEY, JSON.stringify({ resumes: [legacy] }));
    const { store } = loadResumeStore();
    expect(store.resumes).toHaveLength(1);
    expect(localStorage.getItem(LEGACY_RESUME_KEY)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(RESUME_STORE_KEY) ?? '{}').version).toBe(2);
  });
});
