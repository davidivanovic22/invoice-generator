import { createId } from '../../lib/files';

export type ResumeTemplateId = 'modern' | 'classic' | 'minimal' | 'executive' | 'creative' | 'compact';
export type ResumeFont = 'sans' | 'dm' | 'grotesk' | 'serif' | 'elegant';
export type ResumeDensity = 'compact' | 'normal' | 'relaxed';

export type SectionKind =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'languages'
  | 'projects'
  | 'certificates'
  | 'courses'
  | 'awards'
  | 'volunteering'
  | 'internships'
  | 'references'
  | 'interests'
  | 'custom';

export type EntryItem = {
  id: string;
  title: string;
  subtitle: string;
  location: string;
  start: string;
  end: string;
  /** Free text; lines starting with "-" or "•" render as bullet points. */
  description: string;
};

export type LanguageItem = { id: string; name: string; level: string };

type SectionBase = { id: string; kind: SectionKind; title: string; hidden: boolean };
export type EntriesSection = SectionBase & { type: 'entries'; items: EntryItem[] };
export type TagsSection = SectionBase & { type: 'tags'; items: string[] };
export type LanguagesSection = SectionBase & { type: 'languages'; items: LanguageItem[] };
export type TextSection = SectionBase & { type: 'text'; text: string };
export type ResumeSection = EntriesSection | TagsSection | LanguagesSection | TextSection;

export type PersonalInfo = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedin: string;
  github: string;
  photo: string;
  extras: { id: string; label: string; value: string }[];
};

export type ResumeDesign = {
  template: ResumeTemplateId;
  accentColor: string;
  font: ResumeFont;
  density: ResumeDensity;
  showPhoto: boolean;
};

export type Resume = {
  id: string;
  /** Internal name shown in the list, e.g. "Frontend — English". */
  name: string;
  personal: PersonalInfo;
  sections: ResumeSection[];
  design: ResumeDesign;
  createdAt: string;
  updatedAt: string;
};

export type ResumeStore = { version: 2; resumes: Resume[] };

type KindInfo = {
  title: string;
  type: ResumeSection['type'];
  /** Placement in two-column templates. */
  column: 'main' | 'side';
  labels?: { title: string; subtitle: string; titlePlaceholder: string; subtitlePlaceholder: string; dates?: boolean; location?: boolean };
  description: string;
};

export const SECTION_KINDS: Record<SectionKind, KindInfo> = {
  summary: { title: 'Profile', type: 'text', column: 'main', description: 'A short pitch: who you are and what you do best' },
  experience: {
    title: 'Experience',
    type: 'entries',
    column: 'main',
    description: 'Jobs, freelance work, positions',
    labels: { title: 'Job title', subtitle: 'Company', titlePlaceholder: 'Senior Frontend Developer', subtitlePlaceholder: 'Acme d.o.o.', dates: true, location: true }
  },
  education: {
    title: 'Education',
    type: 'entries',
    column: 'main',
    description: 'Degrees and schools',
    labels: { title: 'Degree', subtitle: 'School', titlePlaceholder: 'BSc Computer Science', subtitlePlaceholder: 'University of Belgrade', dates: true, location: true }
  },
  skills: { title: 'Skills', type: 'tags', column: 'side', description: 'Tools, technologies, abilities' },
  languages: { title: 'Languages', type: 'languages', column: 'side', description: 'Languages and your level' },
  projects: {
    title: 'Projects',
    type: 'entries',
    column: 'main',
    description: 'Side projects, open source, case studies',
    labels: { title: 'Project', subtitle: 'Role or link', titlePlaceholder: 'Budget tracker app', subtitlePlaceholder: 'github.com/you/project', dates: true }
  },
  certificates: {
    title: 'Certificates',
    type: 'entries',
    column: 'main',
    description: 'Certifications and licences',
    labels: { title: 'Certificate', subtitle: 'Issuer', titlePlaceholder: 'AWS Solutions Architect', subtitlePlaceholder: 'Amazon Web Services', dates: true }
  },
  courses: {
    title: 'Courses',
    type: 'entries',
    column: 'main',
    description: 'Trainings and online courses',
    labels: { title: 'Course', subtitle: 'Provider', titlePlaceholder: 'Advanced React', subtitlePlaceholder: 'Frontend Masters', dates: true }
  },
  awards: {
    title: 'Awards',
    type: 'entries',
    column: 'main',
    description: 'Prizes, scholarships, achievements',
    labels: { title: 'Award', subtitle: 'Given by', titlePlaceholder: 'Hackathon winner', subtitlePlaceholder: 'Belgrade Tech Week', dates: true }
  },
  volunteering: {
    title: 'Volunteering',
    type: 'entries',
    column: 'main',
    description: 'Volunteer work and communities',
    labels: { title: 'Role', subtitle: 'Organisation', titlePlaceholder: 'Mentor', subtitlePlaceholder: 'Code Club', dates: true, location: true }
  },
  internships: {
    title: 'Internships',
    type: 'entries',
    column: 'main',
    description: 'Internships and traineeships',
    labels: { title: 'Role', subtitle: 'Company', titlePlaceholder: 'Software Engineering Intern', subtitlePlaceholder: 'Acme d.o.o.', dates: true, location: true }
  },
  references: {
    title: 'References',
    type: 'entries',
    column: 'main',
    description: 'People who can vouch for you',
    labels: { title: 'Name', subtitle: 'Position and company', titlePlaceholder: 'Marko Jovanović', subtitlePlaceholder: 'CTO at Acme' }
  },
  interests: { title: 'Interests', type: 'tags', column: 'side', description: 'Hobbies and interests' },
  custom: { title: 'Custom section', type: 'text', column: 'main', description: 'Anything else, with your own title' }
};

export const createEntry = (overrides?: Partial<EntryItem>): EntryItem => ({
  id: createId(),
  title: '',
  subtitle: '',
  location: '',
  start: '',
  end: '',
  description: '',
  ...overrides
});

export const createSection = (kind: SectionKind, overrides?: Partial<ResumeSection>): ResumeSection => {
  const info = SECTION_KINDS[kind];
  const base = { id: createId(), kind, title: info.title, hidden: false };
  let section: ResumeSection;
  switch (info.type) {
    case 'entries':
      section = { ...base, type: 'entries', items: [] };
      break;
    case 'tags':
      section = { ...base, type: 'tags', items: [] };
      break;
    case 'languages':
      section = { ...base, type: 'languages', items: [] };
      break;
    default:
      section = { ...base, type: 'text', text: '' };
  }
  return { ...section, ...overrides } as ResumeSection;
};

export const createPersonal = (overrides?: Partial<PersonalInfo>): PersonalInfo => ({
  fullName: '',
  headline: '',
  email: '',
  phone: '',
  location: '',
  website: '',
  linkedin: '',
  github: '',
  photo: '',
  extras: [],
  ...overrides
});

export const createDesign = (overrides?: Partial<ResumeDesign>): ResumeDesign => ({
  template: 'modern',
  accentColor: '#4f46e5',
  font: 'sans',
  density: 'normal',
  showPhoto: true,
  ...overrides
});

export const createEmptyResume = (): Resume => {
  const now = new Date().toISOString();
  return {
    id: createId(),
    name: 'Untitled resume',
    personal: createPersonal(),
    sections: (['summary', 'experience', 'education', 'skills', 'languages'] as SectionKind[]).map((kind) => createSection(kind)),
    design: createDesign(),
    createdAt: now,
    updatedAt: now
  };
};

/** Neutral example content, so a new resume shows what a good one looks like. */
export const createSampleResume = (): Resume => {
  const resume = createEmptyResume();
  resume.name = 'Example resume';
  resume.personal = createPersonal({
    fullName: 'Ana Marković',
    headline: 'Senior Product Designer',
    email: 'ana.markovic@example.com',
    phone: '+381 64 123 4567',
    location: 'Belgrade, Serbia',
    website: 'anamarkovic.design',
    linkedin: 'linkedin.com/in/anamarkovic'
  });
  resume.sections = [
    createSection('summary', {
      text: 'Product designer with 8 years of experience turning complex workflows into calm, usable products. I lead discovery, design systems and hands-on UI work, and I like working closely with engineers to ship fast and learn from real users.'
    }),
    createSection('experience', {
      items: [
        createEntry({
          title: 'Senior Product Designer',
          subtitle: 'Nordeus',
          location: 'Belgrade',
          start: 'Mar 2022',
          end: 'Present',
          description:
            '- Lead designer for the player onboarding team; first-week retention up 14%\n- Built and maintain the cross-platform design system used by 40+ designers and engineers\n- Run weekly research sessions and turn findings into roadmap proposals'
        }),
        createEntry({
          title: 'Product Designer',
          subtitle: 'Seven Bridges',
          location: 'Belgrade',
          start: 'Jun 2019',
          end: 'Feb 2022',
          description:
            '- Redesigned the bioinformatics workflow editor used by 30,000 researchers\n- Cut support tickets about pipeline setup by a third with guided templates'
        }),
        createEntry({
          title: 'UI Designer',
          subtitle: 'Freelance',
          start: '2017',
          end: '2019',
          description: '- Websites and brand identities for 20+ small businesses across the region'
        })
      ]
    }),
    createSection('education', {
      items: [createEntry({ title: 'BA Graphic Design', subtitle: 'Faculty of Applied Arts, University of Arts in Belgrade', start: '2013', end: '2017' })]
    }),
    createSection('skills', {
      items: ['Product strategy', 'User research', 'Design systems', 'Prototyping', 'Figma', 'Accessibility', 'HTML & CSS', 'Workshop facilitation']
    }),
    createSection('languages', {
      items: [
        { id: createId(), name: 'Serbian', level: 'Native' },
        { id: createId(), name: 'English', level: 'C2 · Proficient' },
        { id: createId(), name: 'German', level: 'B1 · Intermediate' }
      ]
    }),
    createSection('interests', { items: ['Analog photography', 'Hiking', 'Typography'] })
  ];
  return resume;
};

export const LANGUAGE_LEVELS = ['Native', 'C2 · Proficient', 'C1 · Advanced', 'B2 · Upper intermediate', 'B1 · Intermediate', 'A2 · Elementary', 'A1 · Beginner'];

export const resumeDisplayName = (resume: Resume) => resume.personal.fullName.trim() || resume.name;
