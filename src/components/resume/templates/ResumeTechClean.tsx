import { ResumeData } from "../../../types/resume";
import { resumePaperClassName, resumePaperStyle } from "./shared";

export const ResumeTechClean = ({ resume }: { resume: ResumeData }) => {
  const accent = resume.editorSettings.accentColor;

  return (
    <div
      className={`${resumePaperClassName} rounded-none p-10 font-mono text-sm`}
      style={{
        ...resumePaperStyle,
        fontSize: `${resume.editorSettings.baseFontSize}px`
      }}
    >
      <div className="flex items-start gap-6 border-b pb-6" style={{ borderColor: `${accent}33` }}>
        {resume.personal.photo ? (
          <img
            src={resume.personal.photo}
            alt={resume.personal.fullName}
            className="h-24 w-24 rounded-xl border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">
            PHOTO
          </div>
        )}

        <div className="flex-1">
          <h1 className="text-3xl font-bold">{resume.personal.fullName}</h1>
          <div className="mt-1 text-slate-500">
            {resume.personal.title} | {resume.personal.email} | {resume.personal.github}
          </div>
          <div className="mt-1 text-slate-500">
            {resume.personal.phone} | {resume.personal.address}
          </div>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="font-bold" style={{ color: accent }}>Summary</h2>
        <p className="mt-2 ">{resume.professionalSummary}</p>
      </section>

      <section className="mt-6">
        <h2 className="font-bold" style={{ color: accent }}>Experience</h2>
        {resume.experience.map((exp) => (
          <div key={exp.id} className="mt-5">
            <div>
              <span className="font-bold">{exp.role}</span> @ {exp.company}
            </div>
            <div className="text-xs  text-slate-400">
              {[exp.project, exp.location].filter(Boolean).join(" • ")}
              {exp.project || exp.location ? " • " : ""}
              {exp.start} - {exp.end}
            </div>
            <div className="mt-2 space-y-1.5 ">
              {exp.bullets.map((b, i) => (
                <div key={i}>- {b}</div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 grid grid-cols-[1fr_1fr] items-start gap-8">
        <div>
          <h2 className="font-bold" style={{ color: accent }}>Skills</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {resume.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex min-h-[32px] items-center justify-center rounded border px-3 py-1 text-xs leading-none"
                style={{ borderColor: `${accent}55` }}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-bold" style={{ color: accent }}>Education</h2>
          <div className="mt-3 space-y-3">
            {resume.education.map((edu) => (
              <div key={edu.id}>
                <div className="font-semibold">{edu.degree}</div>
                <div className=" text-slate-500">{edu.school}</div>
                <div className=" text-slate-400">{edu.start} - {edu.end}</div>
              </div>
            ))}
          </div>

          <h2 className="mt-6 font-bold" style={{ color: accent }}>Languages</h2>
          <div className="mt-3 space-y-1.5">
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