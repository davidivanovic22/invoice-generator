/**
 * Optional cloud sync and sharing through the user's own Supabase project.
 *
 * Without a project configured nothing here runs and the app works exactly as
 * before, from this browser only. When signed in:
 * - resumes, their sections and entries live in relational personal tables;
 * - explicitly connected firms are shared (`paperwork_firms`) with members and
 *   roles: owner, accountant (can edit) and viewer (read only). Its invoices,
 *   clients, invoices, line items, KPO and history live in relational firm tables;
 * - cloud firms appear in the firm list only when the user explicitly opens them.
 * Row-level security in the database (supabase/migrations) makes sure nobody
 * reads a firm they are not a member of. Before anything from the cloud
 * replaces local data, a local backup snapshot is taken.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { collectData, takeSnapshot } from './backup';
import { legacyRestoreTarget } from './legacyRestore';
import { readDatabaseDocuments, saveDatabaseDocument } from './relational';
import { CLOUD_SQL } from './cloudSql';
import { addLinkedFirm, assertUniqueFirmTaxId, firmDisplayName, firmKey, firmTaxId, linkFirm, keepOnlyLocalFirm, readFirms, removeFirm, renameFirm, replaceFirmRegistry, setActiveFirm, DEFAULT_FIRM, FIRMS_KEY, type FirmBaseKey, type FirmRole } from './firms';
import { disableDatabaseMode, isDatabaseMode, onWrite, patchDatabaseData, readRaw, replaceDatabaseData, suspendWrites } from './storage';

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
export type CloudState = { status: CloudStatus; email: string | null; lastSync: string | null; error: string | null; choice: CloudChoice | null; dataReady: boolean; dataRevision: number };

let state: CloudState = { status: 'off', email: null, lastSync: null, error: null, choice: null, dataReady: false, dataRevision: 0 };
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

type Row = { key: string; data: unknown; updated_at: string; firm_id?: string | null };

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

/** Database is authoritative. Only edits made after loading it can be pushed. */
export const decideDatabase = (local: string | null, remote: Row | undefined, meta: Meta[string] | undefined): 'push' | 'pull' | 'clear' | 'none' => {
  if (!remote) return meta?.dirty && local !== null ? 'push' : local !== null ? 'clear' : 'none';
  if (local !== null && sameData(local, remote.data)) return 'none';
  if (!meta?.dirty || meta.syncedAt !== remote.updated_at) return 'pull';
  return 'push';
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

/** Refresh access to already connected firms. A refresh never adds or connects a firm. */
export const linkFirms = async (supabase: SupabaseClient) => {
  const user = await currentUser(supabase);
  if (!user) return false;
  const { data, error } = await supabase.from('paperwork_members').select('firm_id, role').eq('user_id', user.id);
  if (error) throw error;
  const memberships = (data ?? []) as { firm_id: string; role: FirmRole }[];
  const byId = new Map(memberships.map(member => [member.firm_id, member]));
  let changed = false;
  for (const firm of readFirms().firms) {
    if (!firm.cloudId) continue;
    const membership = byId.get(firm.cloudId);
    if (!membership) { linkFirm(firm.id, undefined); changed = true; }
    else if (membership.role !== firm.role) { linkFirm(firm.id, firm.cloudId, membership.role); changed = true; }
  }
  return changed;
};

/** Lists available firms only after the user opens the cloud firm picker. */
export const availableCloudFirms = async () => {
  const supabase = await getClient();
  const user = supabase && await currentUser(supabase);
  if (!supabase || !user) throw new Error('Sign in before connecting a firm.');
  const accepted = await supabase.rpc('paperwork_accept_invites');
  if (accepted.error) throw accepted.error;
  const { data, error } = await supabase.from('paperwork_members').select('firm_id, role, paperwork_firms(name)').eq('user_id', user.id);
  if (error) throw error;
  return (data ?? []) as unknown as { firm_id: string; role: FirmRole; paperwork_firms: { name: string } | null }[];
};

/** Explicitly open an existing cloud firm; never inserts a company in the database. */
export const openCloudFirm = async (cloudId: string) => {
  const supabase = await getClient();
  const user = supabase && await currentUser(supabase);
  if (!supabase || !user) throw new Error('Sign in before connecting a firm.');
  const membership = await supabase.from('paperwork_members').select('role, paperwork_firms(name)').eq('firm_id', cloudId).eq('user_id', user.id).single();
  if (membership.error) throw membership.error;
  const accessible = membership.data as unknown as { role: FirmRole; paperwork_firms: { name: string } | null };
  const firm = readFirms().firms.find(item => item.cloudId === cloudId) ?? addLinkedFirm(accessible.paperwork_firms?.name ?? '', cloudId, accessible.role);
  setActiveFirm(firm.id);
  await saveFirmSelection();
  while (syncing) await new Promise(resolve => window.setTimeout(resolve, 50));
  initializedUserId = null;
  setState({ dataReady: false });
  window.dispatchEvent(new Event('firms-changed'));
  await syncNow();
  return firm;
};

/** Back up cloud and local documents before deleting other firms owned by the signed-in user. */
export const deleteOtherOwnedFirms = async (supabase: SupabaseClient, keepCloudId: string) => {
  const user = await currentUser(supabase);
  if (!user) throw new Error('Sign in before connecting a firm.');
  const firms = await supabase.from('paperwork_firms').select('id, name, created_at').eq('created_by', user.id);
  if (firms.error) throw firms.error;
  if (!firms.data?.some(firm => firm.id === keepCloudId)) throw new Error('Select a firm you own to keep.');
  const ownedIds = firms.data.map(firm => firm.id as string);
  const rows = await readDatabaseDocuments(supabase, ownedIds, false);
  const registry = readFirms();
  const backup = collectData();
  // Separate keys preserve cloud copies even when unsent local edits differ.
  const cloudCopies = firms.data.map(firm => ({ id: 'cloud-backup-' + firm.id, cloudId: firm.id as string, name: firm.name as string, createdAt: firm.created_at as string, role: 'owner' as const }));
  backup[FIRMS_KEY] = JSON.stringify({ ...registry, firms: [...registry.firms, ...cloudCopies] });
  for (const row of rows) {
    const base = FIRM_DATA[row.key as keyof typeof FIRM_DATA];
    if (base) backup[firmKey(base, 'cloud-backup-' + row.firm_id)] = JSON.stringify(row.data);
  }
  if (!await takeSnapshot('before-restore', backup)) throw new Error('Backup failed. No firms were deleted.');
  const removeIds = ownedIds.filter(id => id !== keepCloudId);
  if (removeIds.length) {
    const removed = await supabase.from('paperwork_firms').delete().in('id', removeIds).eq('created_by', user.id).select('id');
    if (removed.error) throw removed.error;
    const deleted = new Set((removed.data ?? []).map(row => row.id));
    if (removeIds.some(id => !deleted.has(id))) throw new Error('Some firms could not be deleted. Check owner access.');
  }
  return removeIds.length;
};

/** The user chooses the firm to preserve; no specific company ID exists in application code. */
export const keepOnlyFirm = async (localId: string) => {
  const firm = readFirms().firms.find(item => item.id === localId);
  if (!firm?.cloudId || firm.role !== 'owner') throw new Error('Select a firm you own to keep.');
  const supabase = await getClient();
  if (!supabase) throw new Error('Sign in before connecting a firm.');
  if (cleaningFirms) return;
  cleaningFirms = true;
  try {
    while (syncing) await new Promise(resolve => window.setTimeout(resolve, 50));
    await deleteOtherOwnedFirms(supabase, firm.cloudId);
    suspendWrites();
    keepOnlyLocalFirm(localId);
    await saveFirmSelection();
    const retainedKeys = new Set(Object.values(FIRM_DATA).map(base => firmKey(base, localId)));
    writeMeta(Object.fromEntries(Object.entries(readMeta()).filter(([key]) => PERSONAL_KEYS.includes(key) || retainedKeys.has(key))));
    window.location.reload();
  } finally {
    cleaningFirms = false;
  }
};

/** Explicit creation writes the initial profile to the database, never to browser storage. */
export const createDatabaseFirm = async (name: string, taxId: string, initialInvoices: unknown) => {
  const supabase = await getClient();
  const user = supabase && await currentUser(supabase);
  if (!supabase || !user) throw new Error('Sign in before connecting a firm.');
  if (!taxId.trim()) throw new Error('Enter the firm PIB before connecting it to the cloud.');
  const result = await supabase.rpc('paperwork_connect_firm', { p_name: name.trim(), p_tax_id: taxId });
  if (result.error) {
    if (result.error.code === 'PGRST202') throw new Error('Apply the firm identity database migration before connecting a new firm.');
    throw result.error;
  }
  if (typeof result.data !== 'string') throw new Error('Could not connect firm.');
  const initial = await supabase.rpc('paperwork_initialize_firm', { p_firm_id: result.data, p_data: initialInvoices });
  if (initial.error) throw initial.error;
  return openCloudFirm(result.data);
};

export const renameDatabaseFirm = async (localId: string, name: string) => {
  const firm = readFirms().firms.find(item => item.id === localId);
  const supabase = await getClient();
  if (!firm?.cloudId || !supabase) throw new Error('Select a firm you own to keep.');
  const result = await supabase.from('paperwork_firms').update({ name: name.trim() }).eq('id', firm.cloudId).select('id');
  if (result.error) throw result.error;
  if (!result.data?.length) throw new Error('Only the owner can rename this firm.');
  renameFirm(localId, name);
};

/** An explicit delete removes the database row, so a later login cannot restore it. */
export const deleteDatabaseFirm = async (localId: string) => {
  const firm = readFirms().firms.find(item => item.id === localId);
  const supabase = await getClient();
  const user = supabase && await currentUser(supabase);
  if (!supabase || !user || !firm?.cloudId || firm.role !== 'owner') throw new Error('Select a firm you own to keep.');
  if (cleaningFirms) return;
  cleaningFirms = true;
  try {
    while (syncing) await new Promise(resolve => window.setTimeout(resolve, 50));
    const rows = await readDatabaseDocuments(supabase, [firm.cloudId], false);
    const backup = collectData();
    const registry = readFirms();
    const cloudCopy = { ...firm, id: 'cloud-backup-' + firm.cloudId };
    backup[FIRMS_KEY] = JSON.stringify({ ...registry, firms: [...registry.firms, cloudCopy] });
    for (const row of rows) {
      const base = FIRM_DATA[row.key as keyof typeof FIRM_DATA];
      if (base) backup[firmKey(base, cloudCopy.id)] = JSON.stringify(row.data);
    }
    if (!await takeSnapshot('before-restore', backup)) throw new Error('Backup failed. No firms were deleted.');
    const removed = await supabase.from('paperwork_firms').delete().eq('id', firm.cloudId).eq('created_by', user.id).select('id');
    if (removed.error) throw removed.error;
    if (!removed.data?.some(row => row.id === firm.cloudId)) throw new Error('Some firms could not be deleted. Check owner access.');
    suspendWrites();
    removeFirm(localId, true);
    await saveFirmSelection();
    window.location.reload();
  } finally { cleaningFirms = false; }
};

/** Only an explicit user action may create a cloud firm. The database reuses PIB identity atomically. */
export const connectFirm = async (localId: string) => {
  const firm = readFirms().firms.find((item) => item.id === localId);
  if (!firm) throw new Error('Firm not found.');
  if (firm.cloudId) return firm;
  const taxId = firmTaxId(localId);
  if (!taxId) throw new Error('Enter the firm PIB before connecting it to the cloud.');
  assertUniqueFirmTaxId(taxId, localId);
  const supabase = await getClient();
  const user = supabase && await currentUser(supabase);
  if (!supabase || !user) throw new Error('Sign in before connecting a firm.');
  const result = await supabase.rpc('paperwork_connect_firm', { p_name: firmDisplayName(firm) || 'Firma', p_tax_id: taxId });
  if (result.error) {
    if (result.error.code === 'PGRST202') throw new Error('Apply the firm identity database migration before connecting a new firm.');
    throw new Error(message(result.error));
  }
  if (typeof result.data !== 'string') throw new Error('Could not connect firm.');
  const membership = await supabase.from('paperwork_members').select('role').eq('firm_id', result.data).eq('user_id', user.id).single();
  if (membership.error) throw membership.error;
  linkFirm(localId, result.data, membership.data.role as FirmRole);
  setActiveFirm(localId);
  await saveFirmSelection();
  initializedUserId = null;
  window.dispatchEvent(new Event('firms-changed'));
  await syncNow();
  return readFirms().firms.find((item) => item.id === localId)!;
};

const fetchRows = async (supabase: SupabaseClient) => {
  const firmIds = Array.from(new Set(syncTargets().map((target) => target.firmId).filter(Boolean))) as string[];
  const rows = new Map<string, Row>();
  for (const row of await readDatabaseDocuments(supabase, firmIds)) rows.set(`${row.firm_id ?? 'personal'}:${row.key}`, row);
  return rows;
};

let initializedUserId: string | null = null;

export const saveFirmSelection = async () => {
  const supabase = await getClient();
  if (!supabase || !state.email) return;
  const registry = readFirms();
  const activeFirmId = registry.firms.find(firm => firm.id === registry.activeId)?.cloudId;
  const { error } = await supabase.rpc('paperwork_select_firms', { p_firm_ids: registry.firms.map(firm => firm.cloudId).filter(Boolean), p_active_firm_id: activeFirmId ?? null });
  if (error) throw error;
};

/** First render and sign-in always load documents from the database, ignoring old browser documents. */
export const hydrateFromDatabase = async (supabase: SupabaseClient, user: User) => {
  const [selection, opened, memberships] = await Promise.all([
    supabase.from('paperwork_user_settings').select('active_firm_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('paperwork_open_firms').select('firm_id, position').eq('user_id', user.id).order('position'),
    supabase.from('paperwork_members').select('firm_id, role, paperwork_firms(name)').eq('user_id', user.id)
  ]);
  if (selection.error) throw selection.error;
  if (opened.error) throw opened.error;
  if (memberships.error) throw memberships.error;
  const accessible = (memberships.data ?? []) as unknown as { firm_id: string; role: FirmRole; paperwork_firms: { name: string } | null }[];
  const previous = readFirms();
  const knownIds: string[] = selection.data ? (opened.data ?? []).map(firm => firm.firm_id) : previous.firms.map(firm => firm.cloudId).filter((id): id is string => Boolean(id));
  const references = knownIds.flatMap(cloudId => {
    const member = accessible.find(item => item.firm_id === cloudId);
    if (!member) return [];
    const old = previous.firms.find(item => item.cloudId === cloudId);
    return [{ id: old?.id ?? cloudId, cloudId, role: member.role, name: member.paperwork_firms?.name ?? '', createdAt: old?.createdAt ?? new Date().toISOString() }];
  });
  const activeCloudId = selection.data?.active_firm_id ?? previous.firms.find(firm => firm.id === previous.activeId)?.cloudId;
  const active = references.find(firm => firm.cloudId === activeCloudId) ?? references[0];
  replaceFirmRegistry(active ? { firms: references, activeId: active.id } : { firms: [{ id: DEFAULT_FIRM, name: '', createdAt: new Date().toISOString() }], activeId: DEFAULT_FIRM });
  const rows = await fetchRows(supabase);
  const documents: Record<string, string> = {};
  const meta: Meta = {};
  for (const target of syncTargets()) {
    const row = rows.get(rowId(target));
    if (row) {
      documents[target.localKey] = JSON.stringify(row.data);
      meta[target.localKey] = { syncedAt: row.updated_at, dirty: false };
    }
  }
  replaceDatabaseData(documents);
  writeMeta(meta);
  initializedUserId = user.id;
  setState({ dataReady: true, dataRevision: state.dataRevision + 1, choice: null });
};

const rowId = (target: Target) => `${target.firmId ?? 'personal'}:${target.key}`;

const push = async (supabase: SupabaseClient, target: Target) => {
  const raw = readRaw(target.localKey);
  if (raw === null || target.readOnly) return;
  const stamp = await saveDatabaseDocument(supabase, target.firmId, target.key, JSON.parse(raw), readMeta()[target.localKey]?.syncedAt);
  updateMeta(target.localKey, { syncedAt: stamp, dirty: readRaw(target.localKey) !== raw });
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

let syncing = false;
let cleaningFirms = false;

/** One full sync pass. */
export const syncNow = async () => {
  const supabase = await getClient();
  if (!supabase || syncing || cleaningFirms) return;
  if (!navigator.onLine) return setState({ status: 'offline' });
  syncing = true;
  setState({ status: 'syncing', error: null });
  try {
    const user = await currentUser(supabase);
    if (!user) {
      initializedUserId = null;
      replaceDatabaseData({});
      return setState({ status: 'signed-out', email: null, dataReady: false, dataRevision: state.dataRevision + 1 });
    }
    if (initializedUserId !== user.id) {
      await hydrateFromDatabase(supabase, user);
      setState({ status: 'synced', lastSync: new Date().toISOString() });
      return;
    }
    const changed = await linkFirms(supabase);
    if (changed) window.dispatchEvent(new Event('firms-changed'));
    const rows = await fetchRows(supabase);
    const meta = readMeta();
    const updates: Record<string, string | null> = {};
    for (const target of syncTargets()) {
      const local = readRaw(target.localKey);
      const remote = rows.get(rowId(target));
      let action = decideDatabase(local, remote, meta[target.localKey]);
      if (target.readOnly && action === 'push') action = remote ? 'pull' : 'clear';
      if (action === 'push') await push(supabase, target);
      if (action === 'pull') {
        updates[target.localKey] = JSON.stringify(remote!.data);
        updateMeta(target.localKey, { syncedAt: remote!.updated_at, dirty: false });
      }
      if (action === 'clear') {
        updates[target.localKey] = null;
        updateMeta(target.localKey, { syncedAt: undefined, dirty: false });
      }
      if (action === 'none' && remote) updateMeta(target.localKey, { syncedAt: remote.updated_at, dirty: false });
    }
    if (Object.keys(updates).length) {
      patchDatabaseData(updates);
      setState({ dataRevision: state.dataRevision + 1 });
    }
    const pending = syncTargets().some(target => !target.readOnly && readMeta()[target.localKey]?.dirty);
    setState({ status: pending ? 'syncing' : 'synced', lastSync: new Date().toISOString() });
    if (pending) { window.clearTimeout(pushTimer); pushTimer = window.setTimeout(() => void syncNow(), 250); }
  } catch (error) {
    setState({ status: navigator.onLine ? 'error' : 'offline', error: message(error) });
  } finally {
    syncing = false;
  }
};

/** An explicit backup restore writes to existing accessible database firms; it never creates firms. */
export const restoreDatabaseBackup = async (data: Record<string, string>) => {
  const supabase = await getClient();
  const user = supabase && await currentUser(supabase);
  if (!supabase || !user) throw new Error('Sign in before connecting a firm.');
  const access = await supabase.from('paperwork_members').select('firm_id, role').eq('user_id', user.id);
  if (access.error) throw access.error;
  const backupRegistry = JSON.parse(data[FIRMS_KEY] ?? 'null') as ReturnType<typeof readFirms> | null;
  const writes: { cloudId: string; key: string; data: unknown }[] = [];
  if (!backupRegistry && Object.values(FIRM_DATA).some(base => data[base])) {
    const cloudId = legacyRestoreTarget(readFirms(), access.data ?? []);
    for (const [key, base] of Object.entries(FIRM_DATA)) {
      if (data[base]) writes.push({ cloudId, key, data: JSON.parse(data[base]) });
    }
  }
  for (const source of backupRegistry?.firms ?? []) {
    for (const [key, base] of Object.entries(FIRM_DATA)) {
      const raw = data[firmKey(base, source.id)];
      if (!raw) continue;
      if (!source.cloudId || !access.data?.some(member => member.firm_id === source.cloudId && member.role !== 'viewer')) {
        throw new Error('The backup contains a firm that is not connected or no longer exists in the database.');
      }
      writes.push({ cloudId: source.cloudId, key, data: JSON.parse(raw) });
    }
  }
  const resumes = data[PERSONAL_KEYS[0]] ? JSON.parse(data[PERSONAL_KEYS[0]]) : undefined;
  if (!writes.length && resumes === undefined) throw new Error('This backup has no database documents to restore.');
  if (cleaningFirms) throw new Error('Another database operation is still running. Try again when it finishes.');
  cleaningFirms = true;
  try {
    while (syncing) await new Promise(resolve => window.setTimeout(resolve, 50));
    const documents = writes.map(write => ({ firm_id: write.cloudId, key: write.key, data: write.data }));
    const before = collectData();
    const registry = readFirms();
    for (const source of backupRegistry?.firms ?? []) {
      if (writes.some(write => write.cloudId === source.cloudId) && !registry.firms.some(firm => firm.cloudId === source.cloudId)) {
        registry.firms.push({ ...source, id: source.cloudId! });
      }
    }
    before[FIRMS_KEY] = JSON.stringify(registry);
    for (const row of await readDatabaseDocuments(supabase, Array.from(new Set(writes.map(write => write.cloudId))))) {
      const localId = registry.firms.find(firm => firm.cloudId === row.firm_id)?.id;
      const base = FIRM_DATA[row.key as keyof typeof FIRM_DATA];
      if (!row.firm_id) before[row.key] = JSON.stringify(row.data);
      else if (localId && base) before[firmKey(base, localId)] = JSON.stringify(row.data);
    }
    await takeSnapshot('before-restore', before);
    const { error } = await supabase.rpc('paperwork_restore_documents', { p_documents: [...documents, ...(resumes !== undefined ? [{ firm_id: null, key: PERSONAL_KEYS[0], data: resumes }] : [])] });
    if (error) throw error;
    initializedUserId = null;
  } finally {
    cleaningFirms = false;
  }
  await syncNow();
};

/** Kept for old UI callers; the database always wins when reloading. */
export const resolveChoice = async (_keep: 'local' | 'remote') => {
  setState({ choice: null });
  initializedUserId = null;
  await syncNow();
};

const startWatching = () => {
  stopWatching?.();
  const offWrite = onWrite((key) => {
    if (!isSyncedKey(key)) return;
    updateMeta(key, { dirty: true });
    setState({ status: 'syncing' });
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
  if (readCloudConfig() && !isDatabaseMode()) replaceDatabaseData({});
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
  initializedUserId = null;
  if (config) replaceDatabaseData({}); else disableDatabaseMode();
  setState({ dataReady: false, dataRevision: state.dataRevision + 1, status: config ? 'signed-out' : 'off', email: null, lastSync: null, error: null, choice: null });
};

export const signIn = async (email: string, password: string, mode: 'sign-in' | 'sign-up', profile?: import('./accountProfile').AccountProfile) => {
  const supabase = await getClient();
  if (!supabase) throw new Error('Cloud is not set up.');
  if (mode === 'sign-up') {
    const { accountProfileError } = await import('./accountProfile');
    const error = profile ? accountProfileError(profile) : 'Enter your first and last name (up to 80 characters each).';
    if (error) throw new Error(error);
  }
  const result = mode === 'sign-up' ? await supabase.auth.signUp({ email, password, options: { data: {
    first_name: profile!.firstName.trim(), last_name: profile!.lastName.trim(),
    username: profile!.username.trim().toLowerCase(), phone: profile!.phone.trim()
  } } }) : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  if (!result.data.session) return 'confirm-email' as const;
  initializedUserId = null;
  replaceDatabaseData({});
  setState({ email: result.data.session.user.email ?? email, dataReady: false, dataRevision: state.dataRevision + 1 });
  // A new account starts a fresh sync history on this device.
  writeMeta({});
  startWatching();
  await syncNow();
  return 'signed-in' as const;
};

/**
 * Emails an existing account a sign-in link. Opening the link in
 * this browser signs in and starts syncing (the client reads the session from the URL on start).
 */
export const sendSignInLink = async (email: string) => {
  const supabase = await getClient();
  if (!supabase) throw new Error('Cloud is not set up.');
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/account`, shouldCreateUser: false } });
  if (error) throw error;
};

/** Sets (or changes) the password of the signed-in account, e.g. after signing in by link. */
export const setCloudPassword = async (password: string) => {
  const supabase = await getClient();
  if (!supabase) throw new Error('Cloud is not set up.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
};

export const usernameAvailable = async (username: string) => {
  const supabase = await getClient();
  if (!supabase) throw new Error('Cloud is not set up.');
  const { data, error } = await supabase.rpc('paperwork_username_available', { p_username: username.trim().toLowerCase() });
  if (error) throw error;
  return data === true;
};

export const getAccountProfile = async (): Promise<import('./accountProfile').AccountProfile> => {
  const supabase = await getClient();
  if (!supabase) throw new Error('Cloud is not set up.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in');
  const { data, error } = await supabase.from('paperwork_profiles').select('first_name,last_name,username,phone').eq('user_id', auth.user.id).single();
  if (error) throw error;
  return { firstName: data.first_name, lastName: data.last_name, username: data.username ?? '', phone: data.phone };
};

export const saveAccountProfile = async (profile: import('./accountProfile').AccountProfile) => {
  const { accountProfileError, normalizeAccountProfile } = await import('./accountProfile');
  const validation = accountProfileError(profile);
  if (validation) throw new Error(validation);
  const value = normalizeAccountProfile(profile);
  const supabase = await getClient();
  if (!supabase) throw new Error('Cloud is not set up.');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Sign in');
  const { error } = await supabase.from('paperwork_profiles').update({ first_name: value.firstName, last_name: value.lastName, username: value.username, phone: value.phone }).eq('user_id', auth.user.id).select('user_id').single();
  if (error) throw new Error(error.code === '23505' ? 'This username is already taken.' : error.message);
};

export const signOut = async () => {
  stopWatching?.();
  const supabase = await getClient();
  await supabase?.auth.signOut().catch(() => null);
  writeMeta({});
  initializedUserId = null;
  replaceDatabaseData({});
  setState({ status: 'signed-out', email: null, lastSync: null, choice: null, dataReady: false, dataRevision: state.dataRevision + 1 });
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
