import { ResumeData } from "../../../types/resume";

export const ResumeLanguageListBlock = ({
  resume,
  light = false
}: {
  resume: ResumeData;
  light?: boolean;
}) => (
  <div className={`space-y-3 text-[13px] ${light ? 'text-white' : 'text-slate-700'}`}>
    {resume.languages.map((lang) => (
      <div key={lang.id}>
        <div className="font-medium">{lang.name}</div>
        <div className={light ? 'text-white/70' : 'text-slate-500'}>{lang.level}</div>
      </div>
    ))}
  </div>
);