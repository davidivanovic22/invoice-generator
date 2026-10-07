import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { t, uiLocale } from '../../i18n';
import {
  allowFolder,
  backupFileName,
  chooseFolder,
  collectData,
  folderBackupSupported,
  folderState,
  forgetFolder,
  fromBackupFile,
  KEEP_DAYS,
  KEEP_NEWEST,
  listSnapshots,
  requestPersistentStorage,
  restoreData,
  summarize,
  takeSnapshot,
  toBackupFile,
  writeFolderBackup,
  type FolderState,
  type Snapshot
} from '../../lib/backup';
import { downloadJson } from '../../lib/files';
import { readFirms, firmDisplayName } from '../../lib/firms';
import { isDatabaseMode } from '../../lib/storage';
import { Button } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { SelectField, TextField } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Section } from '../../ui/Layout';
import { useAccount } from './AccountGate';
import { CloudSection } from './CloudSection';
import { AccountProfileSection } from './AccountProfileSection';
import { checkPassword, removeLock, setPassword, updateLockDetails } from './lock';

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat(uiLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

const REASONS: Record<Snapshot['reason'], string> = {
  daily: 'Daily',
  manual: 'Manual',
  'before-restore': 'Before restore'
};

export const AccountPage = () => {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash]);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('Account & backup')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t(isDatabaseMode() ? 'Manage your account and document backups.' : 'Lock the app with a password and keep automatic backups of everything you make.')}</p>
      <div className="mt-6 space-y-4">
        {!isDatabaseMode() && <LockSection />}
        {isDatabaseMode() && <AccountProfileSection />}
        <CloudSection />
        <BackupSection />
      </div>
      <p className="mt-8 flex gap-4 text-xs text-slate-400">
        <Link to="/privacy" className="hover:text-slate-600 hover:underline">
          {t('Privacy policy')}
        </Link>
        <Link to="/terms" className="hover:text-slate-600 hover:underline">
          {t('Terms of use')}
        </Link>
      </p>
    </div>
  );
};

// ---- Password ----------------------------------------------------------------------

const AUTO_LOCK = [0, 5, 15, 30, 60];

const LockSection = () => {
  const { lock, refresh, lockNow } = useAccount();
  const { toast, confirm } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(lock?.name ?? '');
  const [current, setCurrent] = useState('');
  const [password, setPasswordValue] = useState('');
  const [repeat, setRepeat] = useState('');
  const [autoLock, setAutoLock] = useState(lock?.autoLockMinutes ?? 15);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = repeat.length > 0 && repeat !== password;

  const save = async () => {
    if (password.length < 6 || password !== repeat) return;
    setBusy(true);
    setError('');
    if (lock && !(await checkPassword(current))) {
      setBusy(false);
      setError(t('Your current password is not right.'));
      return;
    }
    const code = await setPassword(name, password, autoLock);
    setBusy(false);
    setRecoveryCode(code);
    setEditing(false);
    setCurrent('');
    setPasswordValue('');
    setRepeat('');
    refresh();
  };

  const remove = async () => {
    const ok = await confirm({
      title: t('Remove the password?'),
      message: t('Anyone using this browser will be able to open your invoices and resumes.'),
      confirmLabel: t('Remove password'),
      tone: 'danger'
    });
    if (!ok) return;
    removeLock();
    refresh();
  };

  return (
    <Section
      title={t('Profile & password')}
      icon="lock"
      description={lock ? t('Locked with a password · {name}', { name: lock.name || t('no name') }) : t('Not locked. Anyone using this browser can open the app.')}
    >
      {recoveryCode && (
        <div className="mb-5 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Icon name="alert" className="h-4 w-4" />
            {t('Save your recovery code')}
          </div>
          <p className="mt-1 text-sm text-amber-800">{t('If you forget the password, this code removes the lock. It is shown only now — write it down or save it somewhere safe.')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-white px-3 py-2 font-mono text-base font-semibold tracking-wider text-slate-900 ring-1 ring-amber-200">{recoveryCode}</code>
            <Button
              size="sm"
              icon="copy"
              onClick={() => {
                void navigator.clipboard?.writeText(recoveryCode);
                toast(t('Copied'));
              }}
            >
              {t('Copy')}
            </Button>
            <Button size="sm" icon="check" variant="ghost" onClick={() => setRecoveryCode('')}>
              {t('I saved it')}
            </Button>
          </div>
        </div>
      )}

      {lock && !editing ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t('Your name')}
              value={name}
              onChange={setName}
              onBlur={() => {
                updateLockDetails({ name: name.trim() });
                refresh();
              }}
              hint={t('Shown on the lock screen')}
            />
            <SelectField
              label={t('Lock automatically')}
              value={String(lock.autoLockMinutes)}
              onChange={(value) => {
                updateLockDetails({ autoLockMinutes: Number(value) });
                refresh();
              }}
              options={AUTO_LOCK.map((minutes) => ({ value: String(minutes), label: minutes ? t('After {count} minutes without activity', { count: minutes }) : t('Never') }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon="lock" variant="primary" onClick={lockNow}>
              {t('Lock now')}
            </Button>
            <Button icon="pen" onClick={() => setEditing(true)}>
              {t('Change password')}
            </Button>
            <Button variant="danger" icon="trash" onClick={remove}>
              {t('Remove password')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {!lock && <TextField label={t('Your name')} value={name} onChange={setName} placeholder="David" hint={t('Shown on the lock screen')} />}
          {lock && <TextField label={t('Current password')} type="password" autoComplete="current-password" value={current} onChange={setCurrent} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={lock ? t('New password') : t('Password')}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={setPasswordValue}
              error={tooShort ? t('Use at least 6 characters.') : undefined}
            />
            <TextField
              label={t('Repeat password')}
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={setRepeat}
              error={mismatch ? t('The passwords do not match.') : undefined}
            />
          </div>
          {!lock && (
            <SelectField
              label={t('Lock automatically')}
              value={String(autoLock)}
              onChange={(value) => setAutoLock(Number(value))}
              options={AUTO_LOCK.map((minutes) => ({ value: String(minutes), label: minutes ? t('After {count} minutes without activity', { count: minutes }) : t('Never') }))}
            />
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" icon="lock" onClick={save} disabled={busy || password.length < 6 || password !== repeat || Boolean(lock && !current)}>
              {busy ? t('Saving…') : lock ? t('Save new password') : t('Turn on password')}
            </Button>
            {lock && (
              <Button
                onClick={() => {
                  setEditing(false);
                  setError('');
                }}
              >
                {t('Cancel')}
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {t('There is no server, so the password protects this browser only. Your data is not encrypted, which means a forgotten password can never lose it.')}
          </p>
        </div>
      )}
    </Section>
  );
};

// ---- Backups -------------------------------------------------------------------------

const BackupSection = () => {
  const { toast, confirm } = useFeedback();
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [folder, setFolder] = useState<FolderState>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      setSnapshots(await listSnapshots());
      setFolder(await folderState());
    } catch {
      setUnavailable(true);
      setSnapshots([]);
    }
  }, []);

  useEffect(() => {
    void reload();
    void requestPersistentStorage().then(setPersistent);
  }, [reload]);

  const backupNow = async () => {
    try {
      const snapshot = await takeSnapshot('manual');
      if (!snapshot) return toast(t('There is nothing to back up yet.'), 'info');
      await writeFolderBackup(snapshot).catch(() => false);
      void reload();
    } catch {
      toast(t('The backup could not be saved.'), 'error');
    }
  };

  const restore = async (data: Record<string, string>, when: string) => {
    const counts = summarize(data);
    const registry = readFirms();
    const target = registry.firms.find(firm => firm.id === registry.activeId);
    const databaseMessage = isDatabaseMode()
      ? `Uvoz u bazu: ${!data['studio.firms'] && target ? firmDisplayName(target) : 'postojeće firme povezane u backupu'}. ${counts.invoices} faktura, ${counts.kpo} KPO stavki, ${counts.resumes} CV. Postojeći dokumenti se zamenjuju; prethodno se čuva backup. Uvoz ne kreira firme.`
      : null;
    const ok = await confirm({
      title: t('Restore the backup from {date}?', { date: when }),
      message: databaseMessage ?? t('Your data is replaced with this backup ({invoices} invoices, {resumes} resumes). A backup of what you have now is made first, so you can go back.', counts),
      confirmLabel: t('Restore')
    });
    if (!ok) return;
    try {
      await restoreData(data);
      toast(isDatabaseMode() ? 'Dokumenti su uvezeni u bazu.' : t('Restore'), 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Uvoz nije završen. Proveri vezu sa bazom.', 'error');
    }
  };

  const restoreFromFile = async (file: File) => {
    try {
      const data = fromBackupFile(JSON.parse(await file.text()));
      if (!data) return toast(t('This is not a full Paperwork backup. Use the import on the Invoices or Resumes page for those files.'), 'error');
      await restore(data, file.name);
    } catch {
      toast(t('That file could not be read.'), 'error');
    }
  };

  const setUpFolder = async () => {
    try {
      if (!(await chooseFolder())) return;
      await writeFolderBackup();
      void reload();
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') toast(t('Could not use that folder.'), 'error');
    }
  };

  const latest = snapshots?.[0];

  return (
    <Section
      id="backup"
      title={t('Automatic backups')}
      icon="shield"
      description={latest ? t('Last backup {date}', { date: formatWhen(latest.createdAt) }) : t('A backup is made every day you open the app')}
    >
      {unavailable ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{t('This browser does not allow automatic backups (private window?). Download a backup file instead.')}</p>
      ) : (
        <ul className="space-y-1.5 text-sm text-slate-600">
          <li className="flex gap-2">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            {t('A backup is made every day you use the app. Backups from the last {days} days are kept, and the newest {count} are never deleted.', { days: KEEP_DAYS, count: KEEP_NEWEST })}
          </li>
          <li className="flex gap-2">
            <Icon name={persistent ? 'check' : 'alert'} className={`mt-0.5 h-4 w-4 shrink-0 ${persistent ? 'text-emerald-600' : 'text-amber-500'}`} />
            {persistent ? t('The browser will not clear this data to free up space.') : t('The browser may clear data when space runs low — the folder backup below protects you from that.')}
          </li>
        </ul>
      )}

      {/* Folder on disk */}
      <div className="mt-5 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200">
            <Icon name="folder" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">{t('Backup to a folder on this computer')}</div>
            <p className="mt-0.5 text-sm text-slate-500">
              {folder
                ? folder.permission === 'granted'
                  ? t('Saving to "{name}" every day.', { name: folder.name }) + (folder.lastWrite ? ' ' + t('Last file {date}.', { date: formatWhen(folder.lastWrite) }) : '')
                  : t('Folder "{name}" needs your permission again after the browser restarted.', { name: folder.name })
                : t('Even if the browser data is wiped, a file per day stays on your disk. Pick a folder that syncs (OneDrive, Google Drive, Dropbox) to also have it in the cloud.')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!folderBackupSupported() ? (
                <p className="text-xs text-slate-400">{t('Available in Chrome and Edge. In other browsers, download a backup file from time to time.')}</p>
              ) : folder ? (
                <>
                  {folder.permission !== 'granted' && (
                    <Button
                      size="sm"
                      variant="accent"
                      icon="check"
                      onClick={async () => {
                        if ((await allowFolder()) === 'granted') {
                          await writeFolderBackup().catch(() => false);
                        }
                        void reload();
                      }}
                    >
                      {t('Allow access')}
                    </Button>
                  )}
                  <Button size="sm" icon="folder" onClick={setUpFolder}>
                    {t('Change folder')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await forgetFolder();
                      void reload();
                    }}
                  >
                    {t('Stop')}
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="accent" icon="folder" onClick={setUpFolder}>
                  {t('Choose folder')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="primary" icon="shield" onClick={backupNow} disabled={unavailable}>
          {t('Back up now')}
        </Button>
        <Button
          icon="download"
          onClick={() => {
            const now = new Date().toISOString();
            downloadJson(toBackupFile({ createdAt: now, data: collectData() }), backupFileName(now));
          }}
        >
          {t('Download backup file')}
        </Button>
        <Button icon="upload" onClick={() => fileRef.current?.click()}>
          {t('Restore from file')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void restoreFromFile(file);
          }}
        />
      </div>

      {snapshots && snapshots.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">{t('Saved backups ({count})', { count: snapshots.length })}</h3>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {snapshots.map((snapshot) => {
              const counts = summarize(snapshot.data);
              const when = formatWhen(snapshot.createdAt);
              return (
                <li key={snapshot.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">{when}</div>
                    <div className="text-xs text-slate-500">
                      {t(REASONS[snapshot.reason])} · {t('{count} invoice|{count} invoices', { count: counts.invoices })} · {t('{count} resume|{count} resumes', { count: counts.resumes })}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" icon="download" onClick={() => downloadJson(toBackupFile(snapshot), backupFileName(snapshot.createdAt))}>
                    {t('Download')}
                  </Button>
                  <Button size="sm" icon="refresh" onClick={() => restore(snapshot.data, when)}>
                    {t('Restore')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Section>
  );
};
