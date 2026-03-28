export type ResumeTemplateKey =
  | 'executive-split'
  | 'sidebar-stacked'
  | 'top-banner'
  | 'editorial-columns'
  | 'centered-profile'
  | 'soft-accent-grid'
  | 'modern-minimal'
  | 'elegant-classic'
  | 'dark-pro'
  | 'creative-gradient'
  | 'tech-clean'
  | 'compact-pro';

export type ResumePersonalExtraFieldKey =
  | 'birthPlace'
  | 'gender'
  | 'nationality'
  | 'civilStatus'
  | 'website'
  | 'linkedin'
  | 'github'
  | 'driverLicense'
  | 'dateOfBirth';

export type ResumeCustomSectionKey =
  | 'profile'
  | 'courses'
  | 'internships'
  | 'extracurricularActivities'
  | 'references'
  | 'qualities'
  | 'certificates'
  | 'achievements'
  | 'signature'
  | 'footer';

export type ResumePersonalInfo = {
  fullName: string;
  title: string;
  phone: string;
  email: string;
  address: string;
  linkedin?: string;
  github?: string;
  website?: string;
  photo?: string;

  birthPlace?: string;
  gender?: string;
  nationality?: string;
  civilStatus?: string;
  driverLicense?: string;
  dateOfBirth?: string;
};

export type ResumeExperienceItem = {
  id: string;
  company: string;
  project?: string;
  location?: string;
  role: string;
  start: string;
  end: string;
  bullets: string[];
};

export type ResumeEducationItem = {
  id: string;
  school: string;
  degree: string;
  start: string;
  end: string;
};

export type ResumeLanguageItem = {
  id: string;
  name: string;
  level: string;
};

export type ResumeCourseItem = {
  id: string;
  title: string;
  provider?: string;
  year?: string;
};

export type ResumeInternshipItem = {
  id: string;
  company: string;
  role: string;
  start?: string;
  end?: string;
  description?: string;
};

export type ResumeReferenceItem = {
  id: string;
  name: string;
  role?: string;
  company?: string;
  email?: string;
  phone?: string;
};

export type ResumeCertificateItem = {
  id: string;
  name: string;
  issuer?: string;
  year?: string;
};

export type ResumeAchievementItem = {
  id: string;
  title: string;
  description?: string;
};

export type ResumeCustomSection = {
  id: string;
  title: string;
  items: string[];
};

export type ResumeEnabledSections = {
  profile: boolean;
  courses: boolean;
  internships: boolean;
  extracurricularActivities: boolean;
  references: boolean;
  qualities: boolean;
  certificates: boolean;
  achievements: boolean;
  signature: boolean;
  footer: boolean;
};

export type ResumeEnabledPersonalFields = {
  birthPlace: boolean;
  gender: boolean;
  nationality: boolean;
  civilStatus: boolean;
  website: boolean;
  linkedin: boolean;
  github: boolean;
  driverLicense: boolean;
  dateOfBirth: boolean;
};

export type ResumeEditorSettings = {
  baseFontSize: number;
  titleFontSize: number;
  accentColor: string;
  template: ResumeTemplateKey;
};

export type ResumeData = {
  id: string;
  personal: ResumePersonalInfo;
  professionalSummary: string;
  skills: string[];
  hobbies: string[];
  qualities: string[];
  courses: ResumeCourseItem[];
  internships: ResumeInternshipItem[];
  extracurricularActivities: string[];
  references: ResumeReferenceItem[];
  certificates: ResumeCertificateItem[];
  achievements: ResumeAchievementItem[];
  customSections: ResumeCustomSection[];
  footer?: string;
  signature?: string;

  enabledPersonalFields: ResumeEnabledPersonalFields;
  enabledSections: ResumeEnabledSections;

  experience: ResumeExperienceItem[];
  education: ResumeEducationItem[];
  languages: ResumeLanguageItem[];
  editorSettings: ResumeEditorSettings;
  createdAt: string;
  updatedAt: string;
};

export type ResumesState = {
  resumes: ResumeData[];
  activeResumeId: string | null;
};