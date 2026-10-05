/**
 * A password lock for this browser. There is no server, so this keeps other
 * people who use the computer out of the app; it does not encrypt the data
 * (a forgotten password must never cost you your invoices).
 */

const LOCK_KEY = 'studio.lock';
const SESSION_KEY = 'studio.unlocked';
const ITERATIONS = 250_000;

export type LockSettings = {
  name: string;
  salt: string;
  hash: string;
  recoverySalt: string;
  recoveryHash: string;
  iterations: number;
  /** Minutes without activity before the app locks itself; 0 = never. */
  autoLockMinutes: number;
};

const toBase64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...Array.from(new Uint8Array(bytes))));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

const derive = async (secret: string, salt: string, iterations: number) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(salt), iterations }, key, 256);
  return toBase64(bits);
};

/** Constant-time comparison of two hashes. */
const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
};

/** Recovery codes look like ABCD-EFGH-JKLM-NPQR (no 0/O/1/I to avoid mix-ups). */
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normalizeRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');
const newRecoveryCode = () => {
  const chars = Array.from(randomBytes(16), (byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]).join('');
  return chars.match(/.{4}/g)!.join('-');
};

export const readLock = (): LockSettings | null => {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    const value = raw ? (JSON.parse(raw) as LockSettings) : null;
    return value?.hash && value.salt ? { ...value, autoLockMinutes: value.autoLockMinutes ?? 0 } : null;
  } catch {
    return null;
  }
};

const writeLock = (settings: LockSettings | null) => {
  if (settings) localStorage.setItem(LOCK_KEY, JSON.stringify(settings));
  else localStorage.removeItem(LOCK_KEY);
};

/** Turns the lock on (or changes the password). Returns the new recovery code to show once. */
export const setPassword = async (name: string, password: string, autoLockMinutes: number) => {
  const salt = toBase64(randomBytes(16));
  const recoverySalt = toBase64(randomBytes(16));
  const recoveryCode = newRecoveryCode();
  writeLock({
    name: name.trim(),
    salt,
    hash: await derive(password, salt, ITERATIONS),
    recoverySalt,
    recoveryHash: await derive(normalizeRecoveryCode(recoveryCode), recoverySalt, ITERATIONS),
    iterations: ITERATIONS,
    autoLockMinutes
  });
  markUnlocked();
  return recoveryCode;
};

export const updateLockDetails = (update: Partial<Pick<LockSettings, 'name' | 'autoLockMinutes'>>) => {
  const current = readLock();
  if (current) writeLock({ ...current, ...update });
};

export const removeLock = () => {
  writeLock(null);
  markUnlocked();
};

export const checkPassword = async (password: string) => {
  const lock = readLock();
  return Boolean(lock && same(await derive(password, lock.salt, lock.iterations), lock.hash));
};

export const checkRecoveryCode = async (code: string) => {
  const lock = readLock();
  return Boolean(lock && same(await derive(normalizeRecoveryCode(code), lock.recoverySalt, lock.iterations), lock.recoveryHash));
};

export const isUnlocked = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
};

export const markUnlocked = () => {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Unlock lasts until reload.
  }
};

export const markLocked = () => {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear.
  }
};
