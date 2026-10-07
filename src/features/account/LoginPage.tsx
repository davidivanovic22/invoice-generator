import { useState, type FormEvent } from 'react';
import { t, useLanguage } from '../../i18n';
import { sendSignInLink, signIn, usernameAvailable } from '../../lib/cloud';
import { accountProfileError, emptyAccountProfile, normalizeAccountProfile } from '../../lib/accountProfile';
import { ProfileFields } from './ProfileFields';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/Field';
import { Icon } from '../../ui/Icon';

/** Database authentication lives outside the firm and document providers. */
export const LoginPage = () => {
  const { lang, setLang } = useLanguage();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [profile, setProfile] = useState(emptyAccountProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const authenticate = async (byLink: boolean) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (byLink) {
        await sendSignInLink(email.trim());
        setNotice(t('A sign-in link was sent to {email}. Open it in this browser and you are signed in.', { email: email.trim() }));
      } else {
        if (mode === 'sign-up') {
          const validation = accountProfileError(profile);
          if (validation) throw new Error(t(validation));
          if (password !== repeat) throw new Error(t('Passwords do not match.'));
          if (!(await usernameAvailable(profile.username))) throw new Error(t('This username is already taken.'));
        }
        const result = mode === 'sign-up'
          ? await signIn(email.trim(), password, mode, normalizeAccountProfile(profile))
          : await signIn(email.trim(), password, mode);
        if (result === 'confirm-email') setNotice(t('Check your email and confirm the address, then sign in.'));
        setPassword('');
        setRepeat('');
      }
    } catch (caught) {
      const message = (caught as Error).message;
      setError(/invalid login credentials/i.test(message)
        ? t('Wrong email or password. If you signed in by link before, you have no password yet: use "Email me a sign-in link", then set a password.')
        : t(message));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void authenticate(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className={`w-full ${mode === 'sign-up' ? 'max-w-lg' : 'max-w-sm'}`}>
        <div className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><Icon name="lock" /></span>
            Paperwork
          </div>
          <div className="flex gap-3 text-sm">
            {(['sr', 'en'] as const).map(value => <button key={value} type="button" aria-pressed={lang === value} className={lang === value ? 'font-bold text-indigo-600' : 'text-slate-500'} onClick={() => setLang(value)}>{value.toUpperCase()}</button>)}
          </div>
        </div>
        <form onSubmit={submit} className="space-y-5 rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t(mode === 'sign-in' ? 'Sign in' : 'Create account')}</h1>
            <p className="mt-2 text-sm text-slate-500">{t(mode === 'sign-up' ? 'Create your personal account. You can add firms after signing in.' : 'Sign in to access your firms and documents.')}</p>
          </div>
          {mode === 'sign-up' && <ProfileFields value={profile} onChange={setProfile} disabled={busy} />}
          <TextField label={t('Email')} type="email" autoComplete="email" required value={email} onChange={setEmail} />
          <TextField label={t('Password')} type="password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} required minLength={mode === 'sign-up' ? 6 : undefined} value={password} onChange={setPassword} />
          {mode === 'sign-up' && <TextField label={t('Confirm password')} type="password" autoComplete="new-password" required minLength={6} value={repeat} onChange={setRepeat} />}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={busy}>{busy ? t('Please wait…') : t(mode === 'sign-in' ? 'Sign in' : 'Create account')}</Button>
          {mode === 'sign-in' && <Button icon="mail" className="w-full" onClick={() => void authenticate(true)} disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())} title={t('No password needed')}>{t('Email me a sign-in link')}</Button>}
          <button type="button" className="w-full text-sm font-medium text-indigo-600" disabled={busy} onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); setNotice(''); }}>{t(mode === 'sign-in' ? 'Create account' : 'Sign in')}</button>
        </form>
      </div>
    </main>
  );
};
