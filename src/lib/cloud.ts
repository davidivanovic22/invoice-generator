/**
 * Optional cloud sync and sharing through the user's own Supabase project.
 *
 * Without a project configured nothing here runs and the app works exactly as
 * before, from this browser only. When signed in:
 * - personal data (resumes) syncs to `paperwork_data`;
 * - every firm becomes a shared firm (`paperwork_firms`) with members and
 *   roles: owner, accountant (can edit) and viewer (read only). Its invoices,
 *   KPO book and history sync to `paperwork_firm_data`;
 * - firms other people shared with you appear in your firm list.
 * Row-level security in the database (supabase/migrations) makes sure nobody
 * reads a firm they are not a member of. Before anything from the cloud
 * replaces local data, a local backup snapshot is taken.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { takeSnapshot } from './backup';
import { CLOUD_SQL } from './cloudSql';
import { addLinkedFirm, firmDisplayName, firmKey, linkFirm, readFirms, type FirmBaseKey, type FirmRole } from './firms';
import { onWrite, readRaw, suspendWrites } from './storage';

export { CLOUD_SQL };

const CONFIG_KEY = 'studio.cloud';
const META_KEY = 'studio.cloud.meta';

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

/* ---------- What syncs where ---------- */

/** Firm data kinds in the cloud and their local storage keys. */
const FIRM_DATA: Record<'invoices' | 'kpo' | 'audit', FirmBaseKey> = {
  invoices: 'studio.invoices.v2',
  kpo: 'studio.kpo.v1',
  audit: 'studio.audit.v1'
};
const PERSONAL_KEYS = ['studio.resumes.v2'];

type Target = { localKey: string; firmId: string | null; key: string; readOnly: boolean };

/** Everything that syncs: personal keys, and each cloud-linked firm's data. */
export const syncTargets = (registry = readFirms()): Target[] => [
  ...PERSONAL_KEYS.map((key) => ({ localKey: key, firmId: null, key, readOnly: false })),
  ...registry.firms.flatMap((firm) =>
    firm.cloudId
      ? (Object.keys(FIRM_DATA) as (keyof typeof FIRM_DATA)[]).map((key) => ({
          localKey: firmKey(FIRM_DATA[key], firm.id),
          firmId: firm.cloudId!,
          key,
          readOnly: firm.role === 'viewer'
        }))
      : []
  )
];

const isSyncedKey = (localKey: string) => syncTargets().some((target) => target.localKey === localKey);

/** Per local key: the server timestamp of the version we last saw, and whether local has unsent changes. */
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

type Row = { key: string; data: unknown; updated_at: string; firm_id?: string };

/** JSON with sorted keys, so the same data compares equal whatever order it was saved in. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : item
  );

const sameData = (local: string, remote: unknown) => {
  try {
    return canonical(JSON.parse(local)) === canonical(remote);
  } catch {
    return false;
  }
};

/** What a sync step should do for one key. Pure, so it can be tested. */
export const decide = (local: string | null, remote: Row | undefined, meta: Meta[string] | undefined): 'push' | 'pull' | 'ask' | 'none' => {
  if (!remote) return local !== null ? 'push' : 'none';
  if (local === null) return 'pull';
  // Identical content needs no transfer in either direction.
  if (sameData(local, remote.data)) return 'none';
  if (!meta?.syncedAt) return 'ask';
  const remoteChanged = remote.updated_at !== meta.syncedAt;
  if (remoteChanged) return 'pull';
  return meta.dirty ? 'push' : 'none';
};

/** Viewers never push; when unsure they take the cloud's copy. */
export const decideFor = (target: Pick<Target, 'readOnly'>, local: string | null, remote: Row | undefined, meta: Meta[string] | undefined) => {
  const action = decide(local, remote, meta);
  if (!target.readOnly) return action;
  if (action === 'push') return 'none';
  if (action === 'ask') return 'pull';
  return action;
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

const currentUser = async (supabase: SupabaseClient): Promise<User | null> => (await supabase.auth.getUser()).data.user ?? null;

/** True when a firm has invoices, clients or a business name worth sharing. */
export const firmHasContent = (invoicesRaw: string | null) => {
  try {
    const store = JSON.parse(invoicesRaw ?? 'null');
    return Boolean(store && (store.invoices?.length || store.clients?.length || String(store.profile?.party?.name ?? '').trim()));
  } catch {
    return false;
  }
};

/** Links local firms with the cloud: shares local ones, adds ones shared with you, notes lost access. Returns true if firms were added. */
const linkFirms = async (supabase: SupabaseClient, user: User) => {
  await supabase.rpc('paperwork_accept_invites');
  const { data, error } = await supabase.from('paperwork_members').select('firm_id, role, paperwork_firms(name)').eq('user_id', user.id);
  if (error) throw error;
  const memberships = (data ?? []) as unknown as { firm_id: string; role: FirmRole; paperwork_firms: { name: string } | null }[];
  const byId = new Map(memberships.map((membership) => [membership.firm_id, membership]));
  let added = false;

  for (const firm of readFirms().firms) {
    if (firm.cloudId) {
      const membership = byId.get(firm.cloudId);
      // Access removed: keep the local copy, stop syncing it.
      if (!membership) linkFirm(firm.id, undefined);
      else if (membership.role !== firm.role) linkFirm(firm.id, firm.cloudId, membership.role);
      continue;
    }
    // A local firm with data becomes a cloud firm you own; empty ones stay local.
    if (!firmHasContent(readRaw(firmKey('studio.invoices.v2', firm.id)))) continue;
    const cloudId = crypto.randomUUID();
    const insert = await supabase.from('paperwork_firms').insert({ id: cloudId, name: firmDisplayName(firm) || 'Firma', created_by: user.id });
    if (insert.error) throw insert.error;
    linkFirm(firm.id, cloudId, 'owner');
  }

  const linked = new Set(readFirms().firms.map((firm) => firm.cloudId).filter(Boolean));
  for (const membership of memberships) {
    if (linked.has(membership.firm_id)) continue;
    addLinkedFirm(membership.paperwork_firms?.name ?? '', membership.firm_id, membership.role);
    added = true;
  }
  return added;
};

const fetchRows = async (supabase: SupabaseClient) => {
  const personal = await supabase.from('paperwork_data').select('key, data, updated_at').in('key', PERSONAL_KEYS);
  if (personal.error) throw personal.error;
  const firmIds = Array.from(new Set(syncTargets().map((target) => target.firmId).filter(Boolean))) as string[];
  const firms = firmIds.length ? await supabase.from('paperwork_firm_data').select('firm_id, key, data, updated_at').in('firm_id', firmIds) : { data: [], error: null };
  if (firms.error) throw firms.error;
  const rows = new Map<string, Row>();
  for (const row of (personal.data ?? []) as Row[]) rows.set(`personal:${row.key}`, row);
  for (const row of (firms.data ?? []) as Row[]) rows.set(`${row.firm_id}:${row.key}`, row);
  return rows;
};

const rowId = (target: Target) => `${target.firmId ?? 'personal'}:${target.key}`;

const push = async (supabase: SupabaseClient, target: Target) => {
  const raw = readRaw(target.localKey);
  if (raw === null || target.readOnly) return;
  const query = target.firmId
    ? supabase.from('paperwork_firm_data').upsert({ firm_id: target.firmId, key: target.key, data: JSON.parse(raw) }, { onConflict: 'firm_id,key' })
    : supabase.from('paperwork_data').upsert({ key: target.key, data: JSON.parse(raw) }, { onConflict: 'user_id,key' });
  const { data, error } = await query.select('updated_at').single();
  if (error) throw error;
  updateMeta(target.localKey, { syncedAt: (data as { updated_at: string }).updated_at, dirty: false });
};

const NOTICE_KEY = 'studio.cloud.notice';
export type CloudNotice = 'updated' | 'conflict';

/** What the last reload was about; read once by the banner. */
export const takeCloudNotice = (): CloudNotice | null => {
  try {
    const value = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    return value === 'updated' || value === 'conflict' ? value : null;
  } catch {
    return null;
  }
};

/** Replaces local data with the cloud's (after a local snapshot) and reloads. */
const pullAndReload = async (pulls: { target: Target; row: Row }[], conflict = false) => {
  await takeSnapshot('before-restore').catch(() => null);
  try {
    sessionStorage.setItem(NOTICE_KEY, conflict ? 'conflict' : 'updated');
  } catch {
    // The reload still happens; only the explanation is lost.
  }
  suspendWrites();
  for (const { target, row } of pulls) {
    localStorage.setItem(target.localKey, JSON.stringify(row.data));
    updateMeta(target.localKey, { syncedAt: row.updated_at, dirty: false });
  }
  window.location.reload();
};

let syncing = false;

/** One full sync pass. */
export const syncNow = async () => {
  const supabase = await getClient();
  if (!supabase || state.choice || syncing) return;
  if (!navigator.onLine) return setState({ status: 'offline' });
  syncing = true;
  setState({ status: 'syncing', error: null });
  try {
    const user = await currentUser(supabase);
    if (!user) return setState({ status: 'signed-out', email: null });
    const addedFirms = await linkFirms(supabase, user);
    const rows = await fetchRows(supabase);
    const meta = readMeta();
    const pulls: { target: Target; row: Row }[] = [];
    // Someone else saved a newer version while this device had unsent changes.
    let conflict = false;
    const ask: CloudChoice = { local: {}, remote: {} };
    for (const target of syncTargets()) {
      const local = readRaw(target.localKey);
      const remote = rows.get(rowId(target));
      const action = decideFor(target, local, remote, meta[target.localKey]);
      if (action === 'push') await push(supabase, target);
      if (action === 'pull') {
        pulls.push({ target, row: remote! });
        if (local !== null && meta[target.localKey]?.dirty && !target.readOnly) conflict = true;
      }
      if (action === 'ask') {
        ask.local[target.localKey] = local!;
        ask.remote[target.localKey] = JSON.stringify(remote!.data);
      }
      // In step with the cloud (same content): remember its version.
      if (action === 'none' && remote && local !== null && sameData(local, remote.data) && meta[target.localKey]?.syncedAt !== remote.updated_at) {
        updateMeta(target.localKey, { syncedAt: remote.updated_at, dirty: false });
      }
    }
    if (Object.keys(ask.local).length) return setState({ status: 'synced', choice: ask });
    if (pulls.length) return pullAndReload(pulls, conflict);
    setState({ status: 'synced', lastSync: new Date().toISOString() });
    // New shared firms appear in the firm list.
    if (addedFirms) window.dispatchEvent(new Event('firms-changed'));
  } catch (error) {
    setState({ status: navigator.onLine ? 'error' : 'offline', error: message(error) });
  } finally {
    syncing = false;
  }
};

/** First connection with data on both sides: the user picks which copy to keep (the other is backed up locally). */
export const resolveChoice = async (keep: 'local' | 'remote') => {
  const supabase = await getClient();
  const choice = state.choice;
  if (!supabase || !choice) return;
  setState({ choice: null, status: 'syncing' });
  try {
    const targets = syncTargets().filter((target) => target.localKey in choice.local);
    if (keep === 'local') {
      for (const target of targets) await push(supabase, target);
      setState({ status: 'synced', lastSync: new Date().toISOString() });
    } else {
      const rows = await fetchRows(supabase);
      await pullAndReload(targets.filter((target) => rows.has(rowId(target))).map((target) => ({ target, row: rows.get(rowId(target))! })));
    }
  } catch (error) {
    setState({ status: 'error', error: message(error) });
  }
};

const startWatching = () => {
  stopWatching?.();
  const offWrite = onWrite((key) => {
    if (!isSyncedKey(key)) return;
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
  const result = mode === 'sign-up' ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
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

/* ---------- Sharing a firm ---------- */

export type Member = { userId: string; email: string; role: FirmRole };
export type Invite = { email: string; role: FirmRole };

export const listPeople = async (cloudId: string): Promise<{ members: Member[]; invites: Invite[] }> => {
  const supabase = await getClient();
  if (!supabase) return { members: [], invites: [] };
  const [members, invites] = await Promise.all([
    supabase.from('paperwork_members').select('user_id, email, role').eq('firm_id', cloudId),
    supabase.from('paperwork_invites').select('email, role').eq('firm_id', cloudId)
  ]);
  if (members.error) throw members.error;
  return {
    members: ((members.data ?? []) as { user_id: string; email: string; role: FirmRole }[]).map((row) => ({ userId: row.user_id, email: row.email, role: row.role })),
    invites: (invites.data ?? []) as Invite[]
  };
};

export const invitePerson = async (cloudId: string, email: string, role: FirmRole) => {
  const supabase = await getClient();
  if (!supabase) throw new Error('Cloud is not set up.');
  const { error } = await supabase.from('paperwork_invites').upsert({ firm_id: cloudId, email: email.trim().toLowerCase(), role }, { onConflict: 'firm_id,email' });
  if (error) throw error;
};

export const cancelInvite = async (cloudId: string, email: string) => {
  const supabase = await getClient();
  const { error } = (await supabase?.from('paperwork_invites').delete().eq('firm_id', cloudId).eq('email', email)) ?? { error: null };
  if (error) throw error;
};

export const changeRole = async (cloudId: string, userId: string, role: FirmRole) => {
  const supabase = await getClient();
  const { error } = (await supabase?.from('paperwork_members').update({ role }).eq('firm_id', cloudId).eq('user_id', userId)) ?? { error: null };
  if (error) throw error;
};

export const removePerson = async (cloudId: string, userId: string) => {
  const supabase = await getClient();
  const { error } = (await supabase?.from('paperwork_members').delete().eq('firm_id', cloudId).eq('user_id', userId)) ?? { error: null };
  if (error) throw error;
};

export const currentUserId = async () => {
  const supabase = await getClient();
  return supabase ? (await currentUser(supabase))?.id ?? null : null;
};
