import type {
  ResumeCustomSectionKey,
  ResumeEnabledPersonalFields,
  ResumeEnabledSections,
  ResumePersonalExtraFieldKey
} from '../types/resume';

export const PERSONAL_FIELD_LABELS: Record<ResumePersonalExtraFieldKey, string> = {
  birthPlace: 'Place of birth',
  gender: 'Gender',
  nationality: 'Nationality',
  civilStatus: 'Civil status',
  website: 'Website',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  driverLicense: 'Driver’s license',
  dateOfBirth: 'Date of birth'
};

export const SECTION_LABELS: Record<ResumeCustomSectionKey, string> = {
  profile: 'Profile',
  courses: 'Courses',
  internships: 'Internships',
  extracurricularActivities: 'Extracurricular activities',
  references: 'References',
  qualities: 'Qualities',
  certificates: 'Certificates',
  achievements: 'Achievements',
  signature: 'Signature',
  footer: 'Footer'
};

export const PERSONAL_FIELD_ORDER: ResumePersonalExtraFieldKey[] = [
  'birthPlace',
  'gender',
  'nationality',
  'civilStatus',
  'website',
  'linkedin',
  'github',
  'driverLicense',
  'dateOfBirth'
];

export const SECTION_ORDER: ResumeCustomSectionKey[] = [
  'profile',
  'courses',
  'internships',
  'extracurricularActivities',
  'references',
  'qualities',
  'certificates',
  'achievements',
  'signature',
  'footer'
];

export const getDisabledPersonalFields = (
  enabled: ResumeEnabledPersonalFields
) => PERSONAL_FIELD_ORDER.filter((key) => !enabled[key]);

export const getDisabledSections = (enabled: ResumeEnabledSections) =>
  SECTION_ORDER.filter((key) => !enabled[key]);