import { ResumeData } from "../../../types/resume";

export const ResumeContactListBlock = ({
  resume,
  light = false
}: {
  resume: ResumeData;
  light?: boolean;
}) => {
  const textColor = light ? 'text-white/85' : 'text-slate-700';

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
  ].filter((item): item is string => typeof item === 'string' && item.trim().length > 0);

  return (
    <div className={`space-y-1 ${textColor}`}>
      {rows.map((item, i) => (
        <div key={`${item}-${i}`} className="break-words text-[13px] leading-7">
          {item}
        </div>
      ))}
    </div>
  );
};