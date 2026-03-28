import type {
  ResumeAchievementItem,
  ResumeCertificateItem,
  ResumeCourseItem,
  ResumeCustomSection,
  ResumeData,
  ResumeEducationItem,
  ResumeEditorSettings,
  ResumeEnabledPersonalFields,
  ResumeEnabledSections,
  ResumeExperienceItem,
  ResumeInternshipItem,
  ResumeLanguageItem,
  ResumePersonalInfo,
  ResumeReferenceItem
} from '../types/resume';

export const createId = (): string => crypto.randomUUID();

export const createResumePersonalInfo = (
  overrides?: Partial<ResumePersonalInfo>
): ResumePersonalInfo => ({
  fullName: 'David Ivanović',
  title: 'Full Stack Developer',
  phone: '+381690352342',
  email: 'ivanovicdavid788@gmail.com',
  address: 'Dimitrije Tucovića 22, 18210 Prćilovica, Serbia',
  linkedin: 'linkedin.com/in/david-ivanovic',
  github: 'github.com/davidivanovic22',
  website: '',
  photo: '',
  birthPlace: '',
  gender: '',
  nationality: '',
  civilStatus: '',
  driverLicense: '',
  dateOfBirth: '',
  ...overrides
});

export const createResumeExperienceItem = (
  overrides?: Partial<ResumeExperienceItem>
): ResumeExperienceItem => ({
  id: createId(),
  company: '',
  project: '',
  location: '',
  role: '',
  start: '',
  end: '',
  bullets: [''],
  ...overrides
});

export const createResumeEducationItem = (
  overrides?: Partial<ResumeEducationItem>
): ResumeEducationItem => ({
  id: createId(),
  school: '',
  degree: '',
  start: '',
  end: '',
  ...overrides
});

export const createResumeLanguageItem = (
  overrides?: Partial<ResumeLanguageItem>
): ResumeLanguageItem => ({
  id: createId(),
  name: '',
  level: '',
  ...overrides
});

export const createResumeCourseItem = (
  overrides?: Partial<ResumeCourseItem>
): ResumeCourseItem => ({
  id: createId(),
  title: '',
  provider: '',
  year: '',
  ...overrides
});

export const createResumeInternshipItem = (
  overrides?: Partial<ResumeInternshipItem>
): ResumeInternshipItem => ({
  id: createId(),
  company: '',
  role: '',
  start: '',
  end: '',
  description: '',
  ...overrides
});

export const createResumeReferenceItem = (
  overrides?: Partial<ResumeReferenceItem>
): ResumeReferenceItem => ({
  id: createId(),
  name: '',
  role: '',
  company: '',
  email: '',
  phone: '',
  ...overrides
});

export const createResumeCertificateItem = (
  overrides?: Partial<ResumeCertificateItem>
): ResumeCertificateItem => ({
  id: createId(),
  name: '',
  issuer: '',
  year: '',
  ...overrides
});

export const createResumeAchievementItem = (
  overrides?: Partial<ResumeAchievementItem>
): ResumeAchievementItem => ({
  id: createId(),
  title: '',
  description: '',
  ...overrides
});

export const createResumeCustomSection = (
  overrides?: Partial<ResumeCustomSection>
): ResumeCustomSection => ({
  id: createId(),
  title: 'Custom section',
  items: [''],
  ...overrides
});

export const createResumeEnabledPersonalFields = (
  overrides?: Partial<ResumeEnabledPersonalFields>
): ResumeEnabledPersonalFields => ({
  birthPlace: false,
  gender: false,
  nationality: false,
  civilStatus: false,
  website: false,
  linkedin: true,
  github: true,
  driverLicense: false,
  dateOfBirth: false,
  ...overrides
});

export const createResumeEnabledSections = (
  overrides?: Partial<ResumeEnabledSections>
): ResumeEnabledSections => ({
  profile: true,
  courses: false,
  internships: false,
  extracurricularActivities: false,
  references: false,
  qualities: false,
  certificates: false,
  achievements: false,
  signature: false,
  footer: false,
  ...overrides
});

export const createResumeEditorSettings = (
  overrides?: Partial<ResumeEditorSettings>
): ResumeEditorSettings => ({
  baseFontSize: 16,
  titleFontSize: 34,
  accentColor: '#1d4ed8',
  template: 'executive-split',
  ...overrides
});

export const createResume = (): ResumeData => {
  const now = new Date().toISOString();

  return {
    id: createId(),
    personal: createResumePersonalInfo(),
    professionalSummary:
      'Experienced Full Stack Developer with strong expertise in Angular, .NET, React, and Spring Boot.',
    skills: [
      'Angular',
      '.NET',
      'React',
      'Spring Boot',
      'TypeScript',
      'JavaScript'
    ],
    hobbies: [],
    qualities: [],
    courses: [],
    internships: [],
    extracurricularActivities: [],
    references: [],
    certificates: [],
    achievements: [],
    customSections: [],
    footer: '',
    signature: '',
    enabledPersonalFields: createResumeEnabledPersonalFields(),
    enabledSections: createResumeEnabledSections(),
    experience: [
      createResumeExperienceItem({
        company: 'Valamar',
        project: 'Maro CMS',
        location: 'Kragujevac',
        role: 'Full Stack Developer',
        start: 'Nov 2024',
        end: 'Present',
        bullets: [
          'Built and maintained Maro CMS using Angular and .NET.',
          'Worked on authentication, localization, media library, and performance improvements.'
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
      createResumeLanguageItem({ name: 'English', level: 'B2 - Upper intermediate' }),
      createResumeLanguageItem({ name: 'Serbian', level: 'Native' })
    ],
    editorSettings: createResumeEditorSettings(),
    createdAt: now,
    updatedAt: now
  };
};