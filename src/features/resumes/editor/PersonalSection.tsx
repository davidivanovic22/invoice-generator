import { createId } from '../../../lib/files';
import { Button, IconButton } from '../../../ui/Button';
import { inputClass, TextField } from '../../../ui/Field';
import { ImagePicker } from '../../../ui/ImageInputs';
import { Section } from '../../../ui/Layout';
import type { PersonalInfo } from '../model';

const EXTRA_SUGGESTIONS = ['Date of birth', 'Nationality', 'Driving licence', 'Availability', 'Portfolio'];

export const PersonalSection = ({ personal, onChange }: { personal: PersonalInfo; onChange: (personal: PersonalInfo) => void }) => {
  const set = (field: keyof PersonalInfo) => (value: string) => onChange({ ...personal, [field]: value });
  return (
    <Section id="personal" title="Personal details" icon="user" description={personal.fullName || 'Name, contact and photo'}>
      <div className="space-y-4">
        <ImagePicker label="Photo" shape="round" maxSize={500} value={personal.photo} onChange={set('photo')} hint="Optional. Many companies prefer CVs without a photo." />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Full name" value={personal.fullName} onChange={set('fullName')} placeholder="Ana Marković" />
          <TextField label="Job title" value={personal.headline} onChange={set('headline')} placeholder="Senior Product Designer" />
          <TextField type="email" label="Email" value={personal.email} onChange={set('email')} placeholder="ana@example.com" />
          <TextField type="tel" label="Phone" value={personal.phone} onChange={set('phone')} placeholder="+381 64 123 4567" />
          <TextField label="Location" value={personal.location} onChange={set('location')} placeholder="Belgrade, Serbia" />
          <TextField label="Website" value={personal.website} onChange={set('website')} placeholder="yourname.com" />
          <TextField label="LinkedIn" value={personal.linkedin} onChange={set('linkedin')} placeholder="linkedin.com/in/you" />
          <TextField label="GitHub" value={personal.github} onChange={set('github')} placeholder="github.com/you" />
        </div>
        {personal.extras.length > 0 && (
          <div className="space-y-2">
            {personal.extras.map((extra) => (
              <div key={extra.id} className="flex items-center gap-2">
                <input
                  aria-label="Field name"
                  value={extra.label}
                  onChange={(event) =>
                    onChange({ ...personal, extras: personal.extras.map((other) => (other.id === extra.id ? { ...other, label: event.target.value } : other)) })
                  }
                  className={`${inputClass} w-40`}
                  placeholder="Label"
                />
                <input
                  aria-label={extra.label || 'Value'}
                  value={extra.value}
                  onChange={(event) =>
                    onChange({ ...personal, extras: personal.extras.map((other) => (other.id === extra.id ? { ...other, value: event.target.value } : other)) })
                  }
                  className={`${inputClass} flex-1`}
                  placeholder="Value"
                />
                <IconButton icon="trash" tone="danger" label="Remove field" onClick={() => onChange({ ...personal, extras: personal.extras.filter((other) => other.id !== extra.id) })} />
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-slate-500">Add field:</span>
          {EXTRA_SUGGESTIONS.filter((label) => !personal.extras.some((extra) => extra.label === label)).map((label) => (
            <Button key={label} size="sm" variant="ghost" icon="plus" onClick={() => onChange({ ...personal, extras: [...personal.extras, { id: createId(), label, value: '' }] })}>
              {label}
            </Button>
          ))}
        </div>
      </div>
    </Section>
  );
};
