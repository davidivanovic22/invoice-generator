import { ResumeData } from "../../../types/resume";
import { resumePaperClassName, resumePaperStyle } from "./shared";

export const ResumeModernMinimal = ({ resume }: { resume: ResumeData }) => {
  const accent = resume.editorSettings.accentColor;

  return (
    <div
      className={`${resumePaperClassName} rounded-none p-12 text-slate-900`}
      style={{
        ...resumePaperStyle,
        fontSize: `${resume.editorSettings.baseFontSize}px`
      }}
    >
      <header className="mb-8 border-b pb-6" style={{ borderColor: `${accent}33` }}>
        <div className="flex items-start gap-6">
          {resume.personal.photo ? (
            <img
              src={resume.personal.photo}
              alt={resume.personal.fullName}
              className="h-24 w-24 rounded-2xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-xs text-slate-400">
              PHOTO
            </div>
          )}

          <div className="flex-1">
            <h1 className="text-4xl font-bold">{resume.personal.fullName}</h1>
            <p className="mt-1 text-lg" style={{ color: accent }}>
              {resume.personal.title}
            </p>
            <div className="mt-3 text-sm text-slate-500">
              {resume.personal.email} • {resume.personal.phone}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {resume.personal.address}
            </div>
          </div>
        </div>
      </header>

      <section className="mb-8">
        <h2
          className="mb-2 text-sm font-bold uppercase tracking-[0.24em]"
          style={{ color: accent }}
        >
          Summary
        </h2>
        <p className=" text-slate-700">{resume.professionalSummary}</p>
      </section>

      <section className="mb-8">
        <h2
          className="mb-4 text-sm font-bold uppercase tracking-[0.24em]"
          style={{ color: accent }}
        >
          Experience
        </h2>

        {resume.experience.map((exp) => (
          <div key={exp.id} className="mb-8">
            <div className="font-semibold text-lg leading-tight">{exp.role}</div>
            <div className="mt-1 text-sm  text-slate-500">
              {[exp.company, exp.project, exp.location].filter(Boolean).join(" • ")} • {exp.start} - {exp.end}
            </div>

            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm  text-slate-700">
              {exp.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-[1fr_1fr] items-start gap-8">
        <div>
          <h2
            className="mb-3 text-sm font-bold uppercase tracking-[0.24em]"
            style={{ color: accent }}
          >
            Education
          </h2>

          {resume.education.map((edu) => (
            <div key={edu.id} className="mb-4">
              <div className="font-semibold leading-tight">{edu.degree}</div>
              <div className="mt-1 text-sm  text-slate-600">{edu.school}</div>
              <div className="mt-1 text-sm  text-slate-500">
                {edu.start} - {edu.end}
              </div>
            </div>
          ))}
        </div>

        <div>
          <h2
            className="mb-3 text-sm font-bold uppercase tracking-[0.24em]"
            style={{ color: accent }}
          >
            Skills
          </h2>

          <div className="flex flex-wrap gap-3">
            {resume.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex min-h-[34px] items-center justify-center rounded-full border px-4 py-1.5 text-xs leading-none"
                style={{ borderColor: `${accent}55`, color: accent }}
              >
                {skill}
              </span>
            ))}
          </div>

          <h2
            className="mb-3 mt-8 text-sm font-bold uppercase tracking-[0.24em]"
            style={{ color: accent }}
          >
            Languages
          </h2>

          <div className="space-y-2 text-sm text-slate-700">
            {resume.languages.map((lang) => (
              <div key={lang.id}>
                <span className="font-medium">{lang.name}</span> — {lang.level}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};