import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { t } from '../../i18n';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { checkPassword, checkRecoveryCode, isUnlocked, markLocked, markUnlocked, readLock, removeLock, type LockSettings } from './lock';

type AccountContextValue = {
  lock: LockSettings | null;
  /** Re-reads the lock after it was changed. */
  refresh: () => void;
  lockNow: () => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export const useAccount = () => {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside AccountGate');
  return value;
};

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/** Shows the lock screen until the right password is entered, then renders the app. */
export const AccountGate = ({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) => {
  const [lock, setLock] = useState(readLock);
  const [unlocked, setUnlocked] = useState(() => !lock || isUnlocked());

  const refresh = useCallback(() => setLock(readLock()), []);
  const lockNow = useCallback(() => {
    markLocked();
    setUnlocked(false);
  }, []);

  // Lock after a quiet period, if the user asked for that.
  const minutes = lock?.autoLockMinutes ?? 0;
  useEffect(() => {
    if (disabled || !lock || !unlocked || minutes <= 0) return;
    let timer = window.setTimeout(lockNow, minutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lockNow, minutes * 60_000);
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, reset));
    };
  }, [disabled, lock, unlocked, minutes, lockNow]);

  const value = useMemo(() => ({ lock: disabled ? null : lock, refresh, lockNow }), [disabled, lock, refresh, lockNow]);

  if (!disabled && lock && !unlocked) {
    return (
      <LockScreen
        lock={lock}
        onUnlock={() => {
          markUnlocked();
          setUnlocked(true);
        }}
        onReset={() => {
          removeLock();
          setLock(null);
          setUnlocked(true);
        }}
      />
    );
  }

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};

const LockScreen = ({ lock, onUnlock, onReset }: { lock: LockSettings; onUnlock: () => void; onReset: () => void }) => {
  const [mode, setMode] = useState<'password' | 'recovery'>('password');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!secret.trim() || checking) return;
    setChecking(true);
    setError('');
    const ok = mode === 'password' ? await checkPassword(secret) : await checkRecoveryCode(secret);
    setChecking(false);
    if (!ok) {
      setError(mode === 'password' ? t('Wrong password. Try again.') : t('That recovery code is not right.'));
      return;
    }
    if (mode === 'password') onUnlock();
    else onReset();
  };

  const switchMode = (next: 'password' | 'recovery') => {
    setMode(next);
    setSecret('');
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-xl ring-1 ring-slate-200">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <Icon name={mode === 'password' ? 'lock' : 'refresh'} className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">
          {mode === 'password' ? (lock.name ? t('Welcome back, {name}', { name: lock.name }) : t('Welcome back')) : t('Use your recovery code')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'password'
            ? t('Enter your password to open Paperwork.')
            : t('Enter the code you saved when you set the password. The lock is removed and your data stays as it is.')}
        </p>
        <div className="mt-5">
          <TextField
            label={mode === 'password' ? t('Password') : t('Recovery code')}
            type={mode === 'password' ? 'password' : 'text'}
            autoComplete={mode === 'password' ? 'current-password' : 'off'}
            placeholder={mode === 'recovery' ? 'ABCD-EFGH-JKLM-NPQR' : undefined}
            value={secret}
            onChange={setSecret}
            error={error || undefined}
            autoFocus
          />
        </div>
        <Button type="submit" variant="accent" size="lg" className="mt-5 w-full" disabled={!secret.trim() || checking}>
          {checking ? t('Checking…') : mode === 'password' ? t('Unlock') : t('Remove lock')}
        </Button>
        <button
          type="button"
          onClick={() => switchMode(mode === 'password' ? 'recovery' : 'password')}
          className="mt-4 w-full text-center text-sm font-medium text-indigo-600 hover:underline"
        >
          {mode === 'password' ? t('Forgot your password?') : t('Back to password')}
        </button>
      </form>
    </div>
  );
};
