import { ResumeData } from "../../types/resume";

export const ResumeTechGrid = ({ resume }: { resume: ResumeData }) => {
  return (
    <div className="grid grid-cols-3 max-w-[900px] mx-auto bg-white shadow-lg">
      <aside className="col-span-1 bg-slate-800 text-white p-6">
        <h2 className="text-lg font-bold">{resume.personal.fullName}</h2>
        <p className="text-sm">{resume.personal.title}</p>

        <div className="mt-6">
          <h3 className="text-xs uppercase text-slate-400">Skills</h3>
          {resume.skills.map((s) => (
            <div key={s} className="text-sm">{s}</div>
          ))}
        </div>
      </aside>

      <main className="col-span-2 p-6">
        <h2 className="font-semibold mb-3">Experience</h2>
        {resume.experience.map((exp) => (
          <div key={exp.id} className="mb-4">
            <div className="font-medium">{exp.role}</div>
            <div className="text-sm text-slate-500">{exp.company}</div>
          </div>
        ))}
      </main>
    </div>
  );
};