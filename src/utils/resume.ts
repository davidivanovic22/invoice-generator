import type {
  ResumeData,
  ResumeEducationItem,
  ResumeEditorSettings,
  ResumeExperienceItem,
  ResumeLanguageItem,
  ResumePersonalInfo
} from '../types/resume';

export const createResumeId = (): string => crypto.randomUUID();

export const createResumePersonalInfo = (
  overrides?: Partial<ResumePersonalInfo>
): ResumePersonalInfo => ({
  fullName: 'David Ivanović',
  title: 'Full Stack Developer',
  phone: '+381690352342',
  email: 'ivanovicdavid788@gmail.com',
  address: 'Dimitrije Tucovića 22, 18210 Prćilovica, Serbia',
  linkedin: 'linkedin.com/in/david-ivanovic-5b1b2b193',
  github: 'github.com/davidivanovic22',
  website: '',
  photo: '',
  ...overrides
});

export const createResumeExperienceItem = (
  overrides?: Partial<ResumeExperienceItem>
): ResumeExperienceItem => ({
  id: createResumeId(),
  company: '',
  project: '',
  location: '',
  role: '',
  start: '',
  end: '',
  bullets: [],
  ...overrides
});

export const createResumeEducationItem = (
  overrides?: Partial<ResumeEducationItem>
): ResumeEducationItem => ({
  id: createResumeId(),
  school: '',
  degree: '',
  start: '',
  end: '',
  ...overrides
});

export const createResumeLanguageItem = (
  overrides?: Partial<ResumeLanguageItem>
): ResumeLanguageItem => ({
  id: createResumeId(),
  name: '',
  level: '',
  ...overrides
});

export const createResumeEditorSettings = (
  partial?: Partial<ResumeEditorSettings>
): ResumeEditorSettings => ({
  baseFontSize: typeof partial?.baseFontSize === 'number' ? partial.baseFontSize : 15,
  titleFontSize: typeof partial?.titleFontSize === 'number' ? partial.titleFontSize : 30,
  accentColor: partial?.accentColor ?? '#4b0d0d',
  template: partial?.template ?? 'executive-split'
});

export const createResume = (): ResumeData => {
  const now = new Date().toISOString();

  return {
    id: createResumeId(),
    personal: createResumePersonalInfo(),
    professionalSummary:
      'Experienced Full Stack Developer with strong expertise in Angular, .NET, React, and Spring Boot. Skilled in building scalable web applications with a focus on frontend and backend development, authentication, and performance optimization.',
    skills: [
      'Angular',
      '.NET',
      'React',
      'Spring Boot',
      'TypeScript',
      'JavaScript',
      'SCSS',
      'Tailwind',
      'Angular Material',
      'MongoDB',
      'JWT',
      'OAuth',
      'Keycloak',
      'REST',
      'Git',
      'JIRA'
    ],
    experience: [
      createResumeExperienceItem({
        role: 'Full Stack Developer',
        company: 'Valamar',
        project: 'Maro CMS',
        location: 'Kragujevac',
        start: 'Nov 2024',
        end: 'Present',
        bullets: [
          'Built and maintained Maro CMS using Angular and .NET.',
          'Worked on authentication, localization, media library, and performance improvements.',
          'Used Angular Signals and modern frontend architecture for predictable state flow.'
        ]
      }),
      createResumeExperienceItem({
        role: 'Frontend Developer',
        company: 'JOPPD APIS',
        location: 'Kragujevac',
        start: 'Apr 2024',
        end: 'Oct 2024',
        bullets: [
          'Worked on tax administration modernization features.',
          'Implemented scalable React UI flows and managed complex form state.',
          'Used Redux Toolkit for consistency and maintainability.'
        ]
      })
    ],
    education: [
      createResumeEducationItem({
        school: 'University Metropolitan Niš',
        degree: 'Software Engineer',
        start: 'Oct 2018',
        end: 'Dec 2022'
      })
    ],
    languages: [
      createResumeLanguageItem({
        name: 'English',
        level: 'B2 - Upper intermediate'
      }),
      createResumeLanguageItem({
        name: 'Serbian',
        level: 'Native'
      })
    ],
    editorSettings: createResumeEditorSettings(),
    createdAt: now,
    updatedAt: now
  };
};