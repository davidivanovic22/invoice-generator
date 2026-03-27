import { ResumeData } from "../../../types/resume";

export const ResumeDarkPro = ({ resume }: { resume: ResumeData }) => {
  return (
    <div className="bg-slate-900 text-white p-10 max-w-[800px] mx-auto rounded-xl">
      <h1 className="text-3xl font-bold text-emerald-400">
        {resume.personal.fullName}
      </h1>

      <p className="text-slate-400">{resume.personal.title}</p>

      <section className="mt-6">
        <h2 className="text-emerald-400 font-semibold">Experience</h2>
        {resume.experience.map((exp) => (
          <div key={exp.id} className="mt-3">
            <div className="font-medium">{exp.role}</div>
            <div className="text-xs text-slate-400">
              {exp.company} • {exp.start}-{exp.end}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};