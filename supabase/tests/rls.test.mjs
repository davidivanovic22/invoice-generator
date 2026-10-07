// Row-level security check against a local Supabase (`npx supabase start`).
// Run: SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... node supabase/tests/rls.test.mjs
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const url = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
// The well-known demo key of every local Supabase; never valid for a hosted project.
const anonKey =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
assert.ok(anonKey, 'Set SUPABASE_ANON_KEY (see `npx supabase status`).');

const stamp = Date.now();
const client = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const account = async (name) => {
  const supabase = client();
  const email = `${name}.${stamp}@paperwork.test`;
  const { data, error } = await supabase.auth.signUp({ email, password: 'Lozinka123!' });
  assert.ifError(error);
  assert.ok(data.session, 'Email confirmation must be off for the local test.');
  return { supabase, email, id: data.user.id };
};

let passed = 0;
const check = async (title, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${title}`);
};

const owner = await account('owner');
const accountant = await account('accountant');
const viewer = await account('viewer');
const stranger = await account('stranger');
let firmId;
const invoiceData = { version: 2, invoices: [{ id: 'invoice-1', number: '2026-01', items: [] }, { id: 'invoice-2', number: '2026-02', items: [] }], clients: [] };
const save = (person, id, key, data) => person.supabase.rpc('paperwork_save_document', { p_firm_id: id, p_key: key, p_data: data });
const read = (person, id = firmId) => person.supabase.rpc('paperwork_read_documents', { p_firm_ids: [id], p_personal: true });

await check('owner creates a firm and becomes its owner', async () => {
  const created = await owner.supabase.rpc('paperwork_connect_firm', { p_name: 'Petar PR', p_tax_id: 'RLS-' + stamp });
  assert.ifError(created.error);
  firmId = created.data;
  const { data } = await owner.supabase.from('paperwork_members').select('role').eq('firm_id', firmId);
  assert.deepEqual(data, [{ role: 'owner' }]);
});

await check('owner saves invoices for the firm', async () => {
  const { data, error } = await save(owner, firmId, 'invoices', invoiceData);
  assert.ifError(error);
  assert.ok(data);
});

await check('a stranger sees nothing and cannot write', async () => {
  const firms = await stranger.supabase.from('paperwork_firms').select('id').eq('id', firmId);
  assert.deepEqual(firms.data, []);
  const rows = await read(stranger);
  assert.deepEqual(rows.data, []);
  const write = await save(stranger, firmId, 'kpo', {});
  assert.ok(write.error, 'stranger write must fail');
  const invite = await stranger.supabase.from('paperwork_invites').insert({ firm_id: firmId, email: stranger.email, role: 'owner' });
  assert.ok(invite.error, 'stranger cannot invite themselves');
});

await check('signed-out visitors see nothing', async () => {
  const { data } = await client().from('paperwork_invoices').select('id');
  assert.deepEqual(data, []);
});

await check('owner invites an accountant and a viewer', async () => {
  const a = await owner.supabase.from('paperwork_invites').insert({ firm_id: firmId, email: accountant.email, role: 'accountant' });
  const v = await owner.supabase.from('paperwork_invites').insert({ firm_id: firmId, email: viewer.email, role: 'viewer' });
  assert.ifError(a.error);
  assert.ifError(v.error);
});

await check('invitees accept on sign-in and see the firm', async () => {
  for (const person of [accountant, viewer]) {
    const { data, error } = await person.supabase.rpc('paperwork_accept_invites');
    assert.ifError(error);
    assert.equal(data, 1);
    const rows = await read(person);
    assert.equal(rows.data.find(row => row.key === 'invoices').data.invoices.length, 2);
  }
});

await check('the accountant can edit, but cannot invite or change roles', async () => {
  const write = await save(accountant, firmId, 'kpo', { entries: [] });
  assert.ifError(write.error);
  const invite = await accountant.supabase.from('paperwork_invites').insert({ firm_id: firmId, email: stranger.email, role: 'viewer' });
  assert.ok(invite.error, 'accountant invite must fail');
  const promote = await accountant.supabase.from('paperwork_members').update({ role: 'owner' }).eq('firm_id', firmId).eq('user_id', accountant.id).select('role');
  assert.deepEqual(promote.data, [], 'accountant cannot promote themselves');
});

await check('the viewer can read but not write', async () => {
  const write = await save(viewer, firmId, 'invoices', { invoices: [] });
  assert.ok(write.error, 'viewer update must change nothing');
  const { data } = await read(owner);
  assert.equal(data.find(row => row.key === 'invoices').data.invoices.length, 2);
});

await check('the owner removes the viewer, who then loses access', async () => {
  const removed = await owner.supabase.from('paperwork_members').delete().eq('firm_id', firmId).eq('user_id', viewer.id).select('user_id');
  assert.equal(removed.data.length, 1);
  const rows = await read(viewer);
  assert.deepEqual(rows.data, []);
});

await check('personal rows stay private', async () => {
  const saved = await save(owner, null, 'studio.resumes.v2', { resumes: [{ id: 'cv', sections: [] }] });
  assert.ifError(saved.error);
  const other = await accountant.supabase.from('paperwork_resumes').select('id');
  assert.deepEqual(other.data, []);
});


await check('concurrent explicit connections reuse one PIB identity', async () => {
  const pib = String(stamp);
  const results = await Promise.all([pib, pib.slice(0, 4) + '-' + pib.slice(4)].map(p_tax_id => owner.supabase.rpc('paperwork_connect_firm', { p_name: 'Identity test', p_tax_id })));
  for (const result of results) assert.ifError(result.error);
  assert.equal(results[0].data, results[1].data);
  const id = results[0].data;
  const denied = await stranger.supabase.rpc('paperwork_connect_firm', { p_name: 'Duplicate', p_tax_id: pib });
  assert.ok(denied.error, 'knowing PIB does not grant access');
  const duplicate = await stranger.supabase.from('paperwork_firms').insert({ name: 'Duplicate', tax_id: pib, created_by: stranger.id });
  assert.ok(duplicate.error, 'old clients cannot create a firm directly on reload');
  const profile = await save(owner, firmId, 'invoices', { profile: { party: { taxId: pib } } });
  assert.equal(profile.error?.code, '23505', 'direct profile edits must not bypass uniqueness');
  const oldPayload = await save(owner, id, 'invoices', { invoices: [] });
  assert.ifError(oldPayload.error);
  const saved = await owner.supabase.from('paperwork_firms').select('tax_id').eq('id', id).single();
  assert.equal(saved.data.tax_id, pib, 'missing profile does not erase identity');
  const blank = await owner.supabase.rpc('paperwork_connect_firm', { p_name: 'Draft', p_tax_id: '  ' });
  assert.ok(blank.error);
});


await check('old clients cannot create blank firms on refresh and owners can permanently delete others', async () => {
  const automatic = await owner.supabase.from('paperwork_firms').insert({ id: crypto.randomUUID(), name: 'Reload duplicate', created_by: owner.id });
  assert.ok(automatic.error);
  const other = await owner.supabase.rpc('paperwork_connect_firm', { p_name: 'Unwanted fixture', p_tax_id: 'DELETE-' + stamp });
  assert.ifError(other.error);
  const deleted = await owner.supabase.from('paperwork_firms').delete().eq('id', other.data).eq('created_by', owner.id).select('id');
  assert.ifError(deleted.error);
  assert.deepEqual(deleted.data, [{ id: other.data }]);
  const main = await read(owner);
  assert.equal(main.data.find(row => row.key === 'invoices').data.invoices.length, 2);
  const memberships = await owner.supabase.from('paperwork_members').select('firm_id').eq('firm_id', other.data);
  assert.deepEqual(memberships.data, []);
});

console.log(`\n${passed} RLS checks passed.`);
