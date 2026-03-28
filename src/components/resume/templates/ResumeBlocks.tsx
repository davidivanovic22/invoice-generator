import { ResumeData } from "../../../types/resume";

/* =========================
   SECTION TITLE
========================= */

type SectionTitleProps = {
  children: React.ReactNode;
  accent: string;
  light?: boolean;
};

export const ResumeSectionTitle = ({
  children,
  accent,
  light = false
}: SectionTitleProps) => (
  <h2
    className="mb-3 text-[11px] font-bold uppercase tracking-[0.28em]"
    style={{ color: light ? "rgba(255,255,255,0.75)" : accent }}
  >
    {children}
  </h2>
);

/* =========================
   PHOTO
========================= */

type PhotoProps = {
  photo?: string;
  alt: string;
  rounded?: string;
  light?: boolean;
  sizeClassName?: string;
};

export const ResumePhoto = ({
  photo,
  alt,
  rounded = "rounded-2xl",
  light = false,
  sizeClassName = "h-24 w-24"
}: PhotoProps) => {
  if (photo) {
    return (
      <img
        src={photo}
        alt={alt}
        className={`${sizeClassName} ${rounded} object-cover border ${light ? "border-white/20" : "border-slate-200"
          }`}
      />
    );
  }

  return (
    <div
      className={`flex ${sizeClassName} items-center justify-center ${rounded} border border-dashed text-xs ${light
          ? "border-white/30 text-white/70"
          : "border-slate-300 text-slate-400"
        }`}
    >
      PHOTO
    </div>
  );
};

/* =========================
   CONTACT + EXTRA PERSONAL FIELDS
========================= */

export const ResumeContactList = ({
  resume,
  light = false
}: {
  resume: ResumeData;
  light?: boolean;
}) => {
  const textColor = light ? "text-white/85" : "text-slate-700";

  const rows = [
    resume.personal.phone,
    resume.personal.email,
    resume.personal.address,
    resume.enabledPersonalFields.dateOfBirth ? resume.personal.dateOfBirth : undefined,
    resume.enabledPersonalFields.birthPlace ? resume.personal.birthPlace : undefined,
    resume.enabledPersonalFields.gender ? resume.personal.gender : undefined,
    resume.enabledPersonalFields.nationality ? resume.personal.nationality : undefined,
    resume.enabledPersonalFields.civilStatus ? resume.personal.civilStatus : undefined,
    resume.enabledPersonalFields.driverLicense ? resume.personal.driverLicense : undefined,
    resume.enabledPersonalFields.linkedin ? resume.personal.linkedin : undefined,
    resume.enabledPersonalFields.github ? resume.personal.github : undefined,
    resume.enabledPersonalFields.website ? resume.personal.website : undefined
  ].filter(Boolean);

  return (
    <div className={`space-y-1 ${textColor}`}>
      {rows.map((item, i) => (
        <div key={i} className="text-[13px] leading-7 break-words">
          {item}
        </div>
      ))}
    </div>
  );
};

/* =========================
   LANGUAGES
========================= */

export const ResumeLanguageList = ({
  resume,
  light = false
}: {
  resume: ResumeData;
  light?: boolean;
}) => (
  <div
    className={`space-y-3 text-[13px] ${light ? "text-white" : "text-slate-700"
      }`}
  >
    {resume.languages.map((lang) => (
      <div key={lang.id}>
        <div className="font-medium">{lang.name}</div>
        <div className={light ? "text-white/70" : "text-slate-500"}>
          {lang.level}
        </div>
      </div>
    ))}
  </div>
);

/* =========================
   SKILLS
========================= */

type ResumeSkillGridProps = {
  skills: string[];
  accent: string;
  light?: boolean;
  isPdf?: boolean;
};

export const ResumeSkillGrid = ({
  skills,
  accent,
  light = false,
  isPdf = false
}: ResumeSkillGridProps) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      {skills.map((skill) => (
        <div
          key={skill}
          className={`
            flex items-center justify-center
            min-h-[34px]
            rounded-full
            px-2
            text-center
            text-[11px]
          `}
          style={{
            paddingBottom: isPdf ? '14px' : undefined,
            border: `1px solid ${light ? "rgba(255,255,255,0.22)" : `${accent}55`
              }`,
            color: light ? "#fff" : accent
          }}
        >
          <span className="leading-[1.2]">{skill}</span>
        </div>
      ))}
    </div>
  );
};

/* =========================
   SUMMARY
========================= */

export const ResumeSummary = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => (
  <section>
    <ResumeSectionTitle accent={accent} light={light}>
      Professional Summary
    </ResumeSectionTitle>

    <p
      className={`text-[14px] leading-7 ${light ? "text-white/90" : "text-slate-700"
        }`}
    >
      {resume.professionalSummary}
    </p>
  </section>
);

/* =========================
   EXPERIENCE
========================= */

export const ResumeExperienceList = ({
  resume,
  accent,
  light = false,
  compact = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
  compact?: boolean;
  isPdf?: boolean;
}) => {
  const textPrimary = light ? "text-white" : "text-slate-900";
  const textSecondary = light ? "text-white/70" : "text-slate-500";
  const textBody = light ? "text-white/85" : "text-slate-700";

  return (
    <section>
      <ResumeSectionTitle accent={accent} light={light}>
        Experience
      </ResumeSectionTitle>

      <div className={compact ? "space-y-6" : "space-y-8"}>
        {resume.experience.map((exp) => (
          <article key={exp.id}>
            <div className="grid grid-cols-[1fr_auto] items-start gap-4">
              <div className="min-w-0">
                <div
                  className={`font-semibold leading-tight ${compact ? "text-[15px]" : "text-[18px]"
                    } ${textPrimary}`}
                >
                  {exp.role}
                </div>

                <div
                  className={`mt-1 ${compact ? "text-[13px]" : "text-sm"
                    } ${textSecondary}`}
                >
                  {[exp.company, exp.project, exp.location]
                    .filter(Boolean)
                    .join(" • ")}
                </div>
              </div>

              <div
                className={`shrink-0 text-right ${compact ? "text-[13px]" : "text-sm"
                  } ${textSecondary}`}
              >
                {exp.start} - {exp.end}
              </div>
            </div>

            <div className="mt-3 space-y-2 text-[13px]">
              {exp.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span
                    className="mt-[6px] block h-[4px] w-[4px] min-w-[4px] rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                  <span className={`${textBody} leading-[1.5]`}>{b}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   EDUCATION
========================= */

export const ResumeEducationList = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => {
  const textPrimary = light ? "text-white" : "text-slate-900";
  const textSecondary = light ? "text-white/70" : "text-slate-500";

  return (
    <section>
      <ResumeSectionTitle accent={accent} light={light}>
        Education
      </ResumeSectionTitle>

      <div className="space-y-4">
        {resume.education.map((edu) => (
          <article key={edu.id}>
            <div className={`text-[15px] font-semibold ${textPrimary}`}>
              {edu.degree}
            </div>

            <div className={`mt-1 text-[13px] ${textSecondary}`}>
              {edu.school}
            </div>

            <div className={`mt-1 text-[13px] ${textSecondary}`}>
              {edu.start} - {edu.end}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   GENERIC STRING SECTION
========================= */

export const ResumeStringSection = ({
  title,
  items,
  accent,
  light = false
}: {
  title: string;
  items: string[];
  accent: string;
  light?: boolean;
}) => {
  if (!items.length) return null;

  return (
    <section>
      <ResumeSectionTitle accent={accent} light={light}>
        {title}
      </ResumeSectionTitle>

      <div className={`space-y-2 text-[13px] ${light ? "text-white/85" : "text-slate-700"}`}>
        {items.map((item, index) => (
          <div key={index}>• {item}</div>
        ))}
      </div>
    </section>
  );
};

/* =========================
   COURSES
========================= */

export const ResumeCoursesList = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => {
  if (!resume.enabledSections.courses || !resume.courses.length) return null;

  const textPrimary = light ? "text-white" : "text-slate-900";
  const textSecondary = light ? "text-white/70" : "text-slate-500";

  return (
    <section>
      <ResumeSectionTitle accent={accent} light={light}>
        Courses
      </ResumeSectionTitle>

      <div className="space-y-4">
        {resume.courses.map((item) => (
          <article key={item.id}>
            <div className={`text-[14px] font-semibold ${textPrimary}`}>
              {item.title}
            </div>
            {(item.provider || item.year) && (
              <div className={`mt-1 text-[13px] ${textSecondary}`}>
                {[item.provider, item.year].filter(Boolean).join(" • ")}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   INTERNSHIPS
========================= */

export const ResumeInternshipsList = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => {
  if (!resume.enabledSections.internships || !resume.internships.length) return null;

  const textPrimary = light ? "text-white" : "text-slate-900";
  const textSecondary = light ? "text-white/70" : "text-slate-500";
  const textBody = light ? "text-white/85" : "text-slate-700";

  return (
    <section>
      <ResumeSectionTitle accent={accent} light={light}>
        Internships
      </ResumeSectionTitle>

      <div className="space-y-4">
        {resume.internships.map((item) => (
          <article key={item.id}>
            <div className={`text-[14px] font-semibold ${textPrimary}`}>
              {[item.role, item.company].filter(Boolean).join(" - ")}
            </div>
            {(item.start || item.end) && (
              <div className={`mt-1 text-[13px] ${textSecondary}`}>
                {[item.start, item.end].filter(Boolean).join(" - ")}
              </div>
            )}
            {item.description ? (
              <div className={`mt-2 text-[13px] ${textBody}`}>
                {item.description}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   REFERENCES
========================= */

export const ResumeReferencesList = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => {
  if (!resume.enabledSections.references || !resume.references.length) return null;

  const textPrimary = light ? "text-white" : "text-slate-900";
  const textSecondary = light ? "text-white/70" : "text-slate-500";

  return (
    <section>
      <ResumeSectionTitle accent={accent} light={light}>
        References
      </ResumeSectionTitle>

      <div className="space-y-4">
        {resume.references.map((item) => (
          <article key={item.id}>
            <div className={`text-[14px] font-semibold ${textPrimary}`}>
              {item.name}
            </div>
            <div className={`mt-1 text-[13px] ${textSecondary}`}>
              {[item.role, item.company].filter(Boolean).join(" • ")}
            </div>
            <div className={`mt-1 text-[13px] ${textSecondary}`}>
              {[item.email, item.phone].filter(Boolean).join(" • ")}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   CERTIFICATES
========================= */

export const ResumeCertificatesList = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => {
  if (!resume.enabledSections.certificates || !resume.certificates.length) return null;

  const textPrimary = light ? "text-white" : "text-slate-900";
  const textSecondary = light ? "text-white/70" : "text-slate-500";

  return (
    <section>
      <ResumeSectionTitle accent={accent} light={light}>
        Certificates
      </ResumeSectionTitle>

      <div className="space-y-4">
        {resume.certificates.map((item) => (
          <article key={item.id}>
            <div className={`text-[14px] font-semibold ${textPrimary}`}>
              {item.name}
            </div>
            <div className={`mt-1 text-[13px] ${textSecondary}`}>
              {[item.issuer, item.year].filter(Boolean).join(" • ")}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   ACHIEVEMENTS
========================= */

export const ResumeAchievementsList = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => {
  if (!resume.enabledSections.achievements || !resume.achievements.length) return null;

  const textPrimary = light ? "text-white" : "text-slate-900";
  const textBody = light ? "text-white/85" : "text-slate-700";

  return (
    <section>
      <ResumeSectionTitle accent={accent} light={light}>
        Achievements
      </ResumeSectionTitle>

      <div className="space-y-4">
        {resume.achievements.map((item) => (
          <article key={item.id}>
            <div className={`text-[14px] font-semibold ${textPrimary}`}>
              {item.title}
            </div>
            {item.description ? (
              <div className={`mt-1 text-[13px] ${textBody}`}>
                {item.description}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   FOOTER / SIGNATURE
========================= */

export const ResumeFooterText = ({
  title,
  value,
  accent,
  light = false
}: {
  title: string;
  value?: string;
  accent: string;
  light?: boolean;
}) => {
  if (!value) return null;

  return (
    <section>
      <ResumeSectionTitle accent={accent} light={light}>
        {title}
      </ResumeSectionTitle>

      <div className={`text-[13px] leading-6 ${light ? "text-white/85" : "text-slate-700"}`}>
        {value}
      </div>
    </section>
  );
};