/**
 * Optional cloud sync through the user's own Supabase project.
 *
 * Without a project configured nothing here runs and the app works exactly as
 * before, from this browser only. When connected and signed in, every saved
 * store (invoices, resumes, KPO) is mirrored to one row per key in the
 * `paperwork_data` table, protected by row-level security so each account
 * only sees its own rows. Before anything from the cloud replaces local data,
 * a local backup snapshot is taken.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { backupKeys, isBackupKey, takeSnapshot } from './backup';
import { onWrite, readRaw, suspendWrites } from './storage';

export const CLOUD_SQL = `-- Paperwork cloud sync: run once in Supabase → SQL Editor
create table if not exists public.paperwork_data (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.paperwork_data enable row level security;

drop policy if exists "Own rows only" on public.paperwork_data;
create policy "Own rows only" on public.paperwork_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.paperwork_touch() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists paperwork_touch on public.paperwork_data;
create trigger paperwork_touch before insert or update on public.paperwork_data
  for each row execute function public.paperwork_touch();`;

const CONFIG_KEY = 'studio.cloud';
const META_KEY = 'studio.cloud.meta';
const TABLE = 'paperwork_data';

export type CloudConfig = { url: string; anonKey: string };

/** Build-time settings win; otherwise the ones entered on the Account page. */
export const readCloudConfig = (): CloudConfig | null => {
  const url = process.env.REACT_APP_SUPABASE_URL;
  const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (url && anonKey) return { url, anonKey };
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null') as CloudConfig | null;
    return saved?.url && saved.anonKey ? saved : null;
  } catch {
    return null;
  }
};

export const cloudConfigFromEnv = () => Boolean(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY);

/* ---------- State for the UI ---------- */

export type CloudStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';
export type CloudChoice = { local: Record<string, string>; remote: Record<string, string> };
export type CloudState = { status: CloudStatus; email: string | null; lastSync: string | null; error: string | null; choice: CloudChoice | null };

let state: CloudState = { status: 'off', email: null, lastSync: null, error: null, choice: null };
const listeners = new Set<(state: CloudState) => void>();
const setState = (patch: Partial<CloudState>) => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
};
export const getCloudState = () => state;
export const subscribeCloud = (listener: (state: CloudState) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/* ---------- Sync bookkeeping ---------- */

/** Per key: the server timestamp of the version we last saw, and whether local has unsent changes. */
type Meta = Record<string, { syncedAt?: string; dirty?: boolean }>;

const readMeta = (): Meta => {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? '{}') as Meta;
  } catch {
    return {};
  }
};
const writeMeta = (meta: Meta) => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Sync falls back to comparing contents.
  }
};
const updateMeta = (key: string, patch: Meta[string]) => {
  const meta = readMeta();
  writeMeta({ ...meta, [key]: { ...meta[key], ...patch } });
};

type Row = { key: string; data: unknown; updated_at: string };

/** What a sync step should do for one key. Pure, so it can be tested. */
export const decide = (local: string | null, remote: Row | undefined, meta: Meta[string] | undefined): 'push' | 'pull' | 'ask' | 'none' => {
  if (!remote) return local !== null ? 'push' : 'none';
  const remoteRaw = JSON.stringify(remote.data);
  if (local === null) return 'pull';
  if (!meta?.syncedAt) return remoteRaw === local ? 'none' : 'ask';
  const remoteChanged = remote.updated_at !== meta.syncedAt;
  if (remoteChanged) return 'pull';
  return meta.dirty ? 'push' : 'none';
};

/* ---------- Client ---------- */

let client: SupabaseClient | null = null;
let stopWatching: (() => void) | null = null;
let pushTimer: number | undefined;
let pollTimer: number | undefined;

const getClient = async () => {
  if (client) return client;
  const config = readCloudConfig();
  if (!config) return null;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'studio.cloud.session' } });
  return client;
};

const message = (error: unknown) => (error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : String(error));

const fetchRows = async (supabase: SupabaseClient): Promise<Row[]> => {
  const { data, error } = await supabase.from(TABLE).select('key, data, updated_at');
  if (error) throw error;
  return ((data ?? []) as Row[]).filter((row) => isBackupKey(row.key));
};

const push = async (supabase: SupabaseClient, key: string) => {
  const raw = readRaw(key);
  if (raw === null) return;
  const { data, error } = await supabase.from(TABLE).upsert({ key, data: JSON.parse(raw) }, { onConflict: 'user_id,key' }).select('updated_at').single();
  if (error) throw error;
  updateMeta(key, { syncedAt: (data as { updated_at: string }).updated_at, dirty: false });
};

/** Replaces local data with the cloud's (after a local snapshot) and reloads. */
const pullAndReload = async (rows: Row[]) => {
  await takeSnapshot('before-restore').catch(() => null);
  suspendWrites();
  for (const row of rows) {
    localStorage.setItem(row.key, JSON.stringify(row.data));
    updateMeta(row.key, { syncedAt: row.updated_at, dirty: false });
  }
  window.location.reload();
};

/** One full sync pass. */
export const syncNow = async () => {
  const supabase = await getClient();
  if (!supabase || state.choice) return;
  if (!navigator.onLine) return setState({ status: 'offline' });
  setState({ status: 'syncing', error: null });
  try {
    const rows = await fetchRows(supabase);
    const byKey = new Map(rows.map((row) => [row.key, row]));
    const meta = readMeta();
    const toPull: Row[] = [];
    const ask: CloudChoice = { local: {}, remote: {} };
    // Local keys plus keys only the cloud has (e.g. a firm added on another device).
    for (const key of Array.from(new Set([...backupKeys(), ...byKey.keys()]))) {
      const local = readRaw(key);
      const action = decide(local, byKey.get(key), meta[key]);
      if (action === 'push') await push(supabase, key);
      if (action === 'pull') toPull.push(byKey.get(key)!);
      if (action === 'ask') {
        ask.local[key] = local!;
        ask.remote[key] = JSON.stringify(byKey.get(key)!.data);
      }
      if (action === 'none' && byKey.get(key) && !meta[key]?.syncedAt) updateMeta(key, { syncedAt: byKey.get(key)!.updated_at, dirty: false });
    }
    if (Object.keys(ask.local).length) return setState({ status: 'synced', choice: ask });
    if (toPull.length) return pullAndReload(toPull);
    setState({ status: 'synced', lastSync: new Date().toISOString() });
  } catch (error) {
    setState({ status: navigator.onLine ? 'error' : 'offline', error: message(error) });
  }
};

/** First connection with data on both sides: the user picks which copy to keep (the other is backed up locally). */
export const resolveChoice = async (keep: 'local' | 'remote') => {
  const supabase = await getClient();
  const choice = state.choice;
  if (!supabase || !choice) return;
  setState({ choice: null, status: 'syncing' });
  try {
    if (keep === 'local') {
      for (const key of Object.keys(choice.local)) await push(supabase, key);
      setState({ status: 'synced', lastSync: new Date().toISOString() });
    } else {
      const rows = await fetchRows(supabase);
      await pullAndReload(rows.filter((row) => row.key in choice.remote));
    }
  } catch (error) {
    setState({ status: 'error', error: message(error) });
  }
};

const startWatching = () => {
  stopWatching?.();
  const offWrite = onWrite((key) => {
    if (!isBackupKey(key)) return;
    updateMeta(key, { dirty: true });
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => void syncNow(), 2500);
  });
  const onFocus = () => void syncNow();
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onFocus);
  pollTimer = window.setInterval(() => void syncNow(), 60_000);
  stopWatching = () => {
    offWrite();
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('online', onFocus);
    window.clearInterval(pollTimer);
    window.clearTimeout(pushTimer);
  };
};

/** Called once at app start. Does nothing when no project is configured. */
export const startCloud = async () => {
  const supabase = await getClient().catch(() => null);
  if (!supabase) return setState({ status: 'off' });
  const { data } = await supabase.auth.getSession();
  if (!data.session) return setState({ status: 'signed-out', email: null });
  setState({ email: data.session.user.email ?? null });
  startWatching();
  await syncNow();
};

/* ---------- Account actions (Account page) ---------- */

export const saveCloudConfig = async (config: CloudConfig | null) => {
  stopWatching?.();
  if (client) await client.auth.signOut().catch(() => null);
  client = null;
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: config.url.trim(), anonKey: config.anonKey.trim() }));
  else localStorage.removeItem(CONFIG_KEY);
  writeMeta({});
  setState({ status: config ? 'signed-out' : 'off', email: null, lastSync: null, error: null, choice: null });
};

export const signIn = async (email: string, password: string, mode: 'sign-in' | 'sign-up') => {
  const supabase = await getClient();
  if (!supabase) throw new Error('Cloud is not set up.');
  const result =
    mode === 'sign-up' ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  if (!result.data.session) return 'confirm-email' as const;
  setState({ email: result.data.session.user.email ?? email });
  // A new account starts a fresh sync history on this device.
  writeMeta({});
  startWatching();
  await syncNow();
  return 'signed-in' as const;
};

export const signOut = async () => {
  stopWatching?.();
  const supabase = await getClient();
  await supabase?.auth.signOut().catch(() => null);
  writeMeta({});
  setState({ status: 'signed-out', email: null, lastSync: null, choice: null });
};
