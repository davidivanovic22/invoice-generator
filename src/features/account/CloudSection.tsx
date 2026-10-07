import { useEffect, useState } from 'react';
import { t, uiLocale } from '../../i18n';
import { summarize } from '../../lib/backup';
import {
  CLOUD_SQL,
  cloudConfigFromEnv,
  getCloudState,
  readCloudConfig,
  resolveChoice,
  saveCloudConfig,
  sendSignInLink,
  setCloudPassword,
  signIn,
  signOut,
  subscribeCloud,
  syncNow,
  takeCloudNotice,
  type CloudState
} from '../../lib/cloud';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { TextField } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Section, Segmented } from '../../ui/Layout';

export const useCloud = () => {
  const [state, setState] = useState<CloudState>(getCloudState);
  useEffect(() => subscribeCloud(setState), []);
  return state;
};

const when = (iso: string) => new Intl.DateTimeFormat(uiLocale(), { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(iso));

/** Account page: connect a Supabase project, sign in, sync. */
export const CloudSection = () => {
  const cloud = useCloud();
  const { toast, confirm } = useFeedback();
  const config = readCloudConfig();
  const [url, setUrl] = useState(config?.url ?? '');
  const [anonKey, setAnonKey] = useState(config?.anonKey ?? '');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linkSentTo, setLinkSentTo] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const sendLink = async () => {
    setBusy(true);
    setError('');
    try {
      await sendSignInLink(email);
      setLinkSentTo(email.trim());
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    setBusy(true);
    try {
      await setCloudPassword(newPassword);
      setNewPassword('');
      toast(t('Password saved. You can now sign in with it on other devices.'), 'info');
    } catch (caught) {
      toast((caught as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    // https everywhere; plain http only for a local Supabase.
    if (!/^(https:\/\/.+|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$)/.test(url.trim()) || anonKey.trim().length < 20) return setError(t('Paste the Project URL (https://…) and the anon public key.'));
    setError('');
    await saveCloudConfig({ url, anonKey });
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await signIn(email.trim(), password, mode);
      if (result === 'confirm-email') toast(t('Check your email and confirm the address, then sign in.'), 'info');
      setPassword('');
    } catch (caught) {
      const message = (caught as Error).message;
      // An account made by a sign-in link has no password yet; say so instead of the raw API text.
      setError(
        /invalid login credentials/i.test(message)
          ? t('Wrong email or password. If you signed in by link before, you have no password yet: use "Email me a sign-in link", then set a password.')
          : message
      );
    } finally {
      setBusy(false);
    }
  };

  const description =
    cloud.status === 'off'
      ? t('Optional. Without it, everything stays in this browser as before.')
      : cloud.email
        ? t('Signed in as {email}', { email: cloud.email })
        : t('Project connected — sign in to sync');

  return (
    <Section id="cloud" title={t('Cloud sync (database)')} icon="globe" description={description}>
      {cloud.status === 'off' ? (
        <div className="space-y-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>
              {t('Create a free project at')}{' '}
              <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
                supabase.com
              </a>
              .
            </li>
            <li>
              {t('Open SQL Editor, paste this and press Run:')}
              <div className="relative mt-2">
                <pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 pr-24 text-[11px] leading-relaxed text-slate-800 ring-1 ring-inset ring-slate-200">{CLOUD_SQL}</pre>
                <Button
                  size="sm"
                  icon="copy"
                  className="absolute right-2 top-2"
                  onClick={() => {
                    void navigator.clipboard?.writeText(CLOUD_SQL);
                    toast(t('Copied'));
                  }}
                >
                  {t('Copy')}
                </Button>
              </div>
            </li>
            <li>{t('In Project Settings → API, copy the Project URL and the anon public key here:')}</li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Project URL" value={url} onChange={setUrl} placeholder="https://abcd.supabase.co" />
            <TextField label="anon public key" value={anonKey} onChange={setAnonKey} placeholder="eyJhbGciOi…" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button variant="accent" icon="link" onClick={connect}>
            {t('Connect project')}
          </Button>
          <p className="text-xs text-slate-400">{t('The anon key is public by design; row-level security makes sure each account only reads its own data.')}</p>
        </div>
      ) : !cloud.email ? (
        <div className="space-y-4">
          <Segmented<'sign-in' | 'sign-up'>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'sign-in', label: t('Sign in') },
              { value: 'sign-up', label: t('Create account') }
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={t('Email')} type="email" autoComplete="email" value={email} onChange={setEmail} />
            <TextField label={t('Password')} type="password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} value={password} onChange={setPassword} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {linkSentTo && (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
              {t('A sign-in link was sent to {email}. Open it in this browser and you are signed in.', { email: linkSentTo })}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" onClick={submit} disabled={busy || !email.trim() || password.length < 6}>
              {busy ? t('Please wait…') : mode === 'sign-in' ? t('Sign in') : t('Create account')}
            </Button>
            <Button icon="mail" onClick={sendLink} disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())} title={t('No password needed')}>
              {t('Email me a sign-in link')}
            </Button>
            {!cloudConfigFromEnv() && (
              <Button variant="ghost" onClick={() => void saveCloudConfig(null)}>
                {t('Disconnect project')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
            <CloudDot status={cloud.status} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium text-slate-900">{statusLabel(cloud)}</div>
              {cloud.error && <div className="mt-0.5 text-xs text-red-600">{cloud.error}</div>}
            </div>
            <Button size="sm" icon="refresh" onClick={() => void syncNow()} disabled={cloud.status === 'syncing'}>
              {t('Sync now')}
            </Button>
          </div>
          <p className="text-xs text-slate-500">{t('Invoices, resumes and the KPO book sync automatically a few seconds after each change, and when you come back to the app. Sign in with the same account on another device to see the same data.')}</p>
          <div className="flex flex-wrap items-end gap-2">
            <TextField
              wrapperClassName="min-w-[220px] flex-1"
              label={t('Set a password (to sign in on other devices)')}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder={t('At least 6 characters')}
            />
            <Button onClick={savePassword} disabled={busy || newPassword.length < 6}>
              {t('Save password')}
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={async () => {
              if (await confirm({ title: t('Sign out?'), message: t('Your data stays in this browser; it just stops syncing.'), confirmLabel: t('Sign out') })) await signOut();
            }}
          >
            {t('Sign out')}
          </Button>
        </div>
      )}
    </Section>
  );
};

export const statusLabel = (cloud: CloudState) => {
  switch (cloud.status) {
    case 'syncing':
      return t('Syncing…');
    case 'synced':
      return cloud.lastSync ? t('Synced · {time}', { time: when(cloud.lastSync) }) : t('Synced');
    case 'offline':
      return t('Offline — changes will sync when you are back online');
    case 'error':
      return t('Sync failed');
    case 'signed-out':
      return t('Not signed in');
    default:
      return t('Cloud sync is off');
  }
};

export const CloudDot = ({ status }: { status: CloudState['status'] }) => (
  <span
    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
      status === 'synced' ? 'bg-emerald-500' : status === 'syncing' ? 'animate-pulse bg-indigo-500' : status === 'error' ? 'bg-red-500' : 'bg-slate-300'
    }`}
  />
);

/** After a reload caused by sync: says what happened, and where the overwritten changes are. */
export const CloudNoticeBanner = () => {
  const [notice, setNotice] = useState(takeCloudNotice);
  useEffect(() => {
    if (notice !== 'updated') return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  const conflict = notice === 'conflict';
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm print:hidden ${conflict ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
      <Icon name={conflict ? 'alert' : 'refresh'} className="h-4 w-4" />
      <span>
        {conflict
          ? t('Someone else changed this data while you were working. Their version is loaded; your last changes are kept in a backup.')
          : t('Loaded the latest changes from the cloud.')}
      </span>
      {conflict && (
        <a href="/account#backup" className="font-medium underline">
          {t('Open backups')}
        </a>
      )}
      <button type="button" aria-label={t('Dismiss')} onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100">
        <Icon name="x" className="h-4 w-4" />
      </button>
    </div>
  );
};

/** Shown once when this device and the cloud both have different data. */
export const CloudChoiceDialog = () => {
  const cloud = useCloud();
  if (!cloud.choice) return null;
  const local = summarize(cloud.choice.local);
  const remote = summarize(cloud.choice.remote);
  const line = (counts: typeof local) =>
    t('{invoices} invoices · {resumes} resumes · {kpo} KPO entries', { invoices: counts.invoices, resumes: counts.resumes, kpo: counts.kpo });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-labelledby="cloud-choice" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="cloud-choice" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Icon name="globe" className="h-5 w-5 text-indigo-600" />
          {t('Which data should be kept?')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('This device and your cloud account have different data. The one you do not keep is saved as a local backup, so nothing is lost.')}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => void resolveChoice('local')} className="rounded-xl p-4 text-left ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-indigo-300">
            <div className="text-sm font-semibold text-slate-900">{t('This device')}</div>
            <div className="mt-1 text-xs text-slate-500">{line(local)}</div>
          </button>
          <button type="button" onClick={() => void resolveChoice('remote')} className="rounded-xl p-4 text-left ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-indigo-300">
            <div className="text-sm font-semibold text-slate-900">{t('Cloud account')}</div>
            <div className="mt-1 text-xs text-slate-500">{line(remote)}</div>
          </button>
        </div>
      </div>
    </div>
  );
};
