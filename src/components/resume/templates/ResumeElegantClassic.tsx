import { ResumeData } from "../../../types/resume";
import { resumePaperClassName, resumePaperStyle } from "./shared";

export const ResumeElegantClassic = ({ resume }: { resume: ResumeData }) => {
  const accent = resume.editorSettings.accentColor;

  return (
    <div
      className={`${resumePaperClassName} rounded-none border p-12 text-black`}
      style={{
        ...resumePaperStyle,
        fontSize: `${resume.editorSettings.baseFontSize}px`
      }}
    >
      <div className="flex items-start gap-6">
        {resume.personal.photo ? (
          <img
            src={resume.personal.photo}
            alt={resume.personal.fullName}
            className="h-24 w-24 rounded-md border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center border border-dashed border-slate-300 text-xs text-slate-400">
            PHOTO
          </div>
        )}

        <div className="flex-1">
          <h1 className="text-3xl font-serif">{resume.personal.fullName}</h1>
          <div className="mt-2 text-sm text-slate-600">
            {resume.personal.title} • {resume.personal.email} • {resume.personal.phone}
          </div>
          <div className="mt-1 text-sm text-slate-600">{resume.personal.address}</div>
        </div>
      </div>

      <hr className="my-6" style={{ borderColor: `${accent}55` }} />

      <section className="mb-8">
        <h2 className="mb-2 uppercase text-sm tracking-[0.24em]" style={{ color: accent }}>
          Summary
        </h2>
        <p className="">{resume.professionalSummary}</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 uppercase text-sm tracking-[0.24em]" style={{ color: accent }}>
          Experience
        </h2>

        {resume.experience.map((exp) => (
          <div key={exp.id} className="mb-6">
            <div className="font-semibold leading-tight">
              {exp.role} - {exp.company}
            </div>
            <div className="mt-1 text-sm italic  text-slate-500">
              {[exp.project, exp.location].filter(Boolean).join(" • ")}
              {exp.project || exp.location ? " • " : ""}
              {exp.start} – {exp.end}
            </div>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm ">
              {exp.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-[1fr_1fr] items-start gap-10">
        <div>
          <h2 className="mb-3 uppercase text-sm tracking-[0.24em]" style={{ color: accent }}>
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
          <h2 className="mb-3 uppercase text-sm tracking-[0.24em]" style={{ color: accent }}>
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

          <h2 className="mb-3 mt-8 uppercase text-sm tracking-[0.24em]" style={{ color: accent }}>
            Languages
          </h2>

          <div className="space-y-2 text-sm">
            {resume.languages.map((lang) => (
              <div key={lang.id}>
                {lang.name} — {lang.level}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};