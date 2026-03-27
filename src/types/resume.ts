export type ResumeTemplateKey =
  | 'executive-split'
  | 'sidebar-stacked'
  | 'top-banner'
  | 'editorial-columns'
  | 'centered-profile'
  | 'soft-accent-grid';

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