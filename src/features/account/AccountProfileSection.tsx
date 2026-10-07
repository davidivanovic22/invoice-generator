import { useEffect, useState, type FormEvent } from 'react';
import { t } from '../../i18n';
import { emptyAccountProfile } from '../../lib/accountProfile';
import { getAccountProfile, saveAccountProfile } from '../../lib/cloud';
import { useCloud } from './CloudSection';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/Field';
import { Section } from '../../ui/Layout';
import { ProfileFields } from './ProfileFields';

export const AccountProfileSection = () => {
  const cloud = useCloud();
  const [profile, setProfile] = useState(emptyAccountProfile);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    getAccountProfile().then(value => { if (active) setProfile(value); })
      .catch(reason => { if (active) setError(t(reason.message)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cloud.email]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || loading) return;
    setBusy(true); setError(''); setSaved(false);
    try { await saveAccountProfile(profile); setSaved(true); }
    catch (reason) { setError(t((reason as Error).message)); }
    finally { setBusy(false); }
  };
  return <Section title={t('Personal profile')}>
    <form onSubmit={save} className="space-y-4">
      <TextField label={t('Email')} value={cloud.email ?? ''} onChange={() => undefined} readOnly />
      <ProfileFields value={profile} onChange={value => { setProfile(value); setSaved(false); }} disabled={loading || busy} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {saved && <p role="status" className="text-sm text-emerald-700">{t('Profile saved.')}</p>}
      <Button type="submit" variant="primary" disabled={loading || busy}>{t('Save profile')}</Button>
    </form>
  </Section>;
};
