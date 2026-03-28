import type { ResumeData, ResumePersonalExtraFieldKey } from '../../../types/resume';
import {
  getDisabledPersonalFields,
  PERSONAL_FIELD_LABELS
} from '../../../utils/resumeFieldConfig';
import { ResumeAddChip } from './ResumeAddChip';

type Props = {
  resume: ResumeData;
  onChangeField: (field: keyof ResumeData['personal'], value: string) => void;
  onEnableField: (field: ResumePersonalExtraFieldKey) => void;
};

export const ResumePersonalSection = ({
  resume,
  onChangeField,
  onEnableField
}: Props) => {
  const { personal, enabledPersonalFields } = resume;
  const disabledFields = getDisabledPersonalFields(enabledPersonalFields);

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4">
      <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
        Personal info
      </div>

      <div className="grid gap-3">
        <input
          value={personal.fullName}
          onChange={(e) => onChangeField('fullName', e.target.value)}
          placeholder="Full name"
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
        <input
          value={personal.title}
          onChange={(e) => onChangeField('title', e.target.value)}
          placeholder="Desired job position"
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
        <input
          value={personal.email}
          onChange={(e) => onChangeField('email', e.target.value)}
          placeholder="Email address"
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
        <input
          value={personal.phone}
          onChange={(e) => onChangeField('phone', e.target.value)}
          placeholder="Phone number"
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />
        <input
          value={personal.address}
          onChange={(e) => onChangeField('address', e.target.value)}
          placeholder="Address"
          className="w-full rounded-xl border border-slate-200 px-3 py-2"
        />

        {enabledPersonalFields.dateOfBirth && (
          <input
            value={personal.dateOfBirth ?? ''}
            onChange={(e) => onChangeField('dateOfBirth', e.target.value)}
            placeholder="Date of birth"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        )}

        {enabledPersonalFields.birthPlace && (
          <input
            value={personal.birthPlace ?? ''}
            onChange={(e) => onChangeField('birthPlace', e.target.value)}
            placeholder="Place of birth"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        )}

        {enabledPersonalFields.gender && (
          <input
            value={personal.gender ?? ''}
            onChange={(e) => onChangeField('gender', e.target.value)}
            placeholder="Gender"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        )}

        {enabledPersonalFields.nationality && (
          <input
            value={personal.nationality ?? ''}
            onChange={(e) => onChangeField('nationality', e.target.value)}
            placeholder="Nationality"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        )}

        {enabledPersonalFields.civilStatus && (
          <input
            value={personal.civilStatus ?? ''}
            onChange={(e) => onChangeField('civilStatus', e.target.value)}
            placeholder="Civil status"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        )}

        {enabledPersonalFields.driverLicense && (
          <input
            value={personal.driverLicense ?? ''}
            onChange={(e) => onChangeField('driverLicense', e.target.value)}
            placeholder="Driver’s license"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        )}

        {enabledPersonalFields.website && (
          <input
            value={personal.website ?? ''}
            onChange={(e) => onChangeField('website', e.target.value)}
            placeholder="Website"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        )}

        {enabledPersonalFields.linkedin && (
          <input
            value={personal.linkedin ?? ''}
            onChange={(e) => onChangeField('linkedin', e.target.value)}
            placeholder="LinkedIn"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        )}

        {enabledPersonalFields.github && (
          <input
            value={personal.github ?? ''}
            onChange={(e) => onChangeField('github', e.target.value)}
            placeholder="GitHub"
            className="w-full rounded-xl border border-slate-200 px-3 py-2"
          />
        )}
      </div>

      {disabledFields.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {disabledFields.map((field) => (
            <ResumeAddChip
              key={field}
              label={PERSONAL_FIELD_LABELS[field]}
              onClick={() => onEnableField(field)}
            />
          ))}
        </div>
      )}
    </div>
  );
};