import { t } from '../../i18n';
import { type AccountProfile } from '../../lib/accountProfile';
import { TextField } from '../../ui/Field';

export const ProfileFields = ({ value, onChange, disabled = false }: {
  value: AccountProfile; onChange: (value: AccountProfile) => void; disabled?: boolean;
}) => {
  const update = (key: keyof AccountProfile) => (text: string) => onChange({ ...value, [key]: text });
  return <>
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label={t('First name')} autoComplete="given-name" required maxLength={80} disabled={disabled} value={value.firstName} onChange={update('firstName')} />
      <TextField label={t('Last name')} autoComplete="family-name" required maxLength={80} disabled={disabled} value={value.lastName} onChange={update('lastName')} />
    </div>
    <TextField label={t('Username')} autoComplete="username" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]{3,30}" hint={t('3–30 letters, numbers or underscores.')} disabled={disabled} value={value.username} onChange={update('username')} />
    <TextField label={t('Phone number (optional)')} type="tel" autoComplete="tel" maxLength={32} placeholder="+381…" disabled={disabled} value={value.phone} onChange={update('phone')} />
  </>;
};
