import { createId } from '../../lib/files';
import { readJson, writeJson } from '../../lib/storage';
import {
  createAts,
  createDesign,
  createEntry,
  createPersonal,
  createSection,
  SECTION_KINDS,
  type Resume,
  type ResumeSection,
  type ResumeStore,
  type ResumeTemplateId,
  type SectionKind
} from './model';

export const RESUME_STORE_KEY = 'studio.resumes.v2';
export const LEGACY_RESUME_KEY = 'resume-builder';

/* Legacy (v1) shape, typed loosely because stored data may be partial. */
type Loose = Record<string, unknown>;
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const arr = (value: unknown): Loose[] => (Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : []);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item : str((item as Loose)?.name))).filter((item) => item.trim()) : []);
const bullets = (lines: string[]) => lines.filter((line) => line.trim()).map((line) => `- ${line.trim()}`).join('\n');

const LEGACY_TEMPLATES: Record<string, ResumeTemplateId> = {
  'elegant-classic': 'classic',
  'premium-classic': 'classic',
  'minimal-classic-block': 'classic',
  'editorial-columns': 'classic',
  'modern-minimal': 'minimal',
  'tech-clean': 'minimal',
  'executive-split': 'executive',
  'executive-slate': 'executive',
  'dark-pro': 'executive',
  'premium-golden': 'executive',
  'creative-gradient': 'creative',
  'cv-curve-sidebar': 'creative',
  'cv-arched-profile': 'creative',
  'modern-ribbon': 'creative',
  'rounded-card-profile': 'creative',
  'compact-pro': 'compact',
  'cv-infographic-split': 'compact'
};

const PERSONAL_EXTRAS: [string, string][] = [
  ['dateOfBirth', 'Date of birth'],
  ['birthPlace', 'Place of birth'],
  ['nationality', 'Nationality'],
  ['driverLicense', 'Driving licence'],
  ['gender', 'Gender'],
  ['civilStatus', 'Marital status']
];

export const migrateLegacyResume = (legacy: Loose): Resume => {
  const personal = (legacy.personal ?? {}) as Loose;
  const enabledFields = (legacy.enabledPersonalFields ?? {}) as Record<string, boolean>;
  const enabled = (legacy.enabledSections ?? {}) as Record<string, boolean>;
  const settings = (legacy.editorSettings ?? {}) as Loose;
  const sections: ResumeSection[] = [];

  const push = (kind: SectionKind, section: Partial<ResumeSection>, isEnabled = true) => {
    const items = (section as { items?: unknown[] }).items;
    const text = (section as { text?: string }).text;
    if ((items && items.length === 0) || (text !== undefined && !text.trim())) return;
    sections.push(createSection(kind, { ...section, hidden: !isEnabled } as Partial<ResumeSection>));
  };

  push('summary', { text: str(legacy.professionalSummary) });
  push('experience', {
    items: arr(legacy.experience).map((item) =>
      createEntry({
        title: str(item.role),
        subtitle: [str(item.company), str(item.project)].filter(Boolean).join(' · '),
        location: str(item.location),
        start: str(item.start),
        end: str(item.end),
        description: bullets(strings(item.bullets))
      })
    )
  });
  push('education', {
    items: arr(legacy.education).map((item) =>
      createEntry({ title: str(item.degree), subtitle: str(item.school), start: str(item.start), end: str(item.end) })
    )
  });
  push('skills', { items: strings(legacy.skills) });
  push('languages', {
    items: arr(legacy.languages).map((item) => ({ id: createId(), name: str(item.name), level: str(item.level) }))
  });
  push(
    'internships',
    {
      items: arr(legacy.internships).map((item) =>
        createEntry({ title: str(item.role), subtitle: str(item.company), start: str(item.start), end: str(item.end), description: str(item.description) })
      )
    },
    enabled.internships !== false
  );
  push(
    'courses',
    { items: arr(legacy.courses).map((item) => createEntry({ title: str(item.title), subtitle: str(item.provider), end: str(item.year) })) },
    enabled.courses !== false
  );
  push(
    'certificates',
    { items: arr(legacy.certificates).map((item) => createEntry({ title: str(item.name), subtitle: str(item.issuer), end: str(item.year) })) },
    enabled.certificates !== false
  );
  push(
    'awards',
    { items: arr(legacy.achievements).map((item) => createEntry({ title: str(item.title), description: str(item.description) })) },
    enabled.achievements !== false
  );
  push(
    'skills',
    { title: 'Strengths', items: strings(legacy.qualities) },
    enabled.qualities !== false
  );
  push(
    'volunteering',
    { title: 'Activities', items: strings(legacy.extracurricularActivities).map((title) => createEntry({ title })) },
    enabled.extracurricularActivities !== false
  );
  push(
    'references',
    {
      items: arr(legacy.references).map((item) =>
        createEntry({
          title: str(item.name),
          subtitle: [str(item.role), str(item.company)].filter(Boolean).join(', '),
          description: [str(item.email), str(item.phone)].filter(Boolean).join('\n')
        })
      )
    },
    enabled.references !== false
  );
  push('interests', { items: strings(legacy.hobbies) });
  for (const custom of arr(legacy.customSections)) {
    push('custom', { title: str(custom.title) || SECTION_KINDS.custom.title, text: bullets(strings(custom.items)) });
  }

  const now = new Date().toISOString();
  return {
    id: str(legacy.id) || createId(),
    name: str(personal.fullName) || 'Imported resume',
    personal: createPersonal({
      fullName: str(personal.fullName),
      headline: str(personal.title),
      email: str(personal.email),
      phone: str(personal.phone),
      location: str(personal.address),
      website: enabledFields.website === false ? '' : str(personal.website),
      linkedin: enabledFields.linkedin === false ? '' : str(personal.linkedin),
      github: enabledFields.github === false ? '' : str(personal.github),
      photo: str(personal.photo),
      extras: PERSONAL_EXTRAS.filter(([key]) => enabledFields[key] && str(personal[key]).trim()).map(([key, label]) => ({
        id: createId(),
        label,
        value: str(personal[key])
      }))
    }),
    sections,
    design: createDesign({
      template: LEGACY_TEMPLATES[str(settings.template)] ?? 'modern',
      accentColor: str(settings.accentColor) || '#4f46e5'
    }),
    ats: createAts(),
    createdAt: str(legacy.createdAt) || now,
    updatedAt: str(legacy.updatedAt) || now
  };
};

const normalizeResume = (raw: Partial<Resume>): Resume => {
  const now = new Date().toISOString();
  return {
    id: raw.id ?? createId(),
    name: raw.name ?? 'Untitled resume',
    personal: createPersonal(raw.personal),
    sections: Array.isArray(raw.sections) ? raw.sections : [],
    design: createDesign(raw.design),
    ats: createAts(raw.ats),
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now
  };
};

export const normalizeResumeStore = (raw: Partial<ResumeStore>): ResumeStore => ({
  version: 2,
  resumes: (Array.isArray(raw.resumes) ? raw.resumes : []).map(normalizeResume)
});

export const loadResumeStore = (): { store: ResumeStore; persist: boolean } => {
  const current = readJson<Partial<ResumeStore>>(RESUME_STORE_KEY);
  if (current.status === 'ok') return { store: normalizeResumeStore(current.value), persist: true };
  if (current.status === 'corrupt') return { store: { version: 2, resumes: [] }, persist: current.backupKey !== null };

  const legacy = readJson<{ resumes?: Loose[] }>(LEGACY_RESUME_KEY);
  if (legacy.status === 'ok' && Array.isArray(legacy.value.resumes)) {
    const store: ResumeStore = { version: 2, resumes: legacy.value.resumes.map(migrateLegacyResume) };
    writeJson(RESUME_STORE_KEY, store);
    return { store, persist: true };
  }
  return { store: { version: 2, resumes: [] }, persist: true };
};
