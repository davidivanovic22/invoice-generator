import { ResumeData } from "../../../types/resume";
import { resumePaperClassName, resumePaperStyle } from "./shared";

export const ResumeCreativeGradient = ({ resume }: { resume: ResumeData }) => {
  const accent = resume.editorSettings.accentColor;

  return (
    <div
      className={`${resumePaperClassName} rounded-none p-10 text-white`}
      style={{
        ...resumePaperStyle,
        fontSize: `${resume.editorSettings.baseFontSize}px`,
        background: `linear-gradient(135deg, ${accent} 0%, #4f46e5 100%)`
      }}
    >
      <div className="flex items-start gap-6">
        {resume.personal.photo ? (
          <img
            src={resume.personal.photo}
            alt={resume.personal.fullName}
            className="h-24 w-24 rounded-2xl border border-white/20 object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-white/30 text-xs text-white/70">
            PHOTO
          </div>
        )}

        <div className="flex-1">
          <h1 className="text-4xl font-bold">{resume.personal.fullName}</h1>
          <p className="opacity-90 text-lg">{resume.personal.title}</p>
          <div className="mt-2 text-sm opacity-80">
            {resume.personal.email} • {resume.personal.phone}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-white/10 p-5 ">
        {resume.professionalSummary}
      </div>

      <div className="mt-6 grid grid-cols-[1.15fr_0.85fr] items-start gap-6">
        <div>
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.24em] opacity-80">
            Experience
          </div>

          <div className="grid gap-4">
            {resume.experience.map((exp) => (
              <div key={exp.id} className="rounded-xl bg-white/10 p-4">
                <div className="font-semibold leading-tight">{exp.role}</div>
                <div className="mt-1 text-sm  opacity-75">
                  {[exp.company, exp.project, exp.location].filter(Boolean).join(" • ")}
                </div>
                <div className="text-sm opacity-70">
                  {exp.start} - {exp.end}
                </div>

                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm ">
                  {exp.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white/10 p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.24em] opacity-80">
              Skills
            </div>
            <div className="flex flex-wrap gap-2">
              {resume.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex min-h-[30px] items-center justify-center rounded-full border border-white/20 px-3 py-1 text-xs leading-none"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white/10 p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.24em] opacity-80">
              Languages
            </div>
            <div className="space-y-2 text-sm">
              {resume.languages.map((lang) => (
                <div key={lang.id}>
                  <div className="font-medium">{lang.name}</div>
                  <div className="opacity-80">{lang.level}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-white/10 p-4">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.24em] opacity-80">
              Education
            </div>
            {resume.education.map((edu) => (
              <div key={edu.id} className="mb-3">
                <div className="font-semibold leading-tight">{edu.degree}</div>
                <div className="mt-1 text-sm  opacity-80">{edu.school}</div>
                <div className="text-sm opacity-70">{edu.start} - {edu.end}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};