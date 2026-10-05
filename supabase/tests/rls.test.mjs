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
const firmId = crypto.randomUUID();

await check('owner creates a firm and becomes its owner', async () => {
  const { error } = await owner.supabase.from('paperwork_firms').insert({ id: firmId, name: 'Petar PR', created_by: owner.id });
  assert.ifError(error);
  const { data } = await owner.supabase.from('paperwork_members').select('role').eq('firm_id', firmId);
  assert.deepEqual(data, [{ role: 'owner' }]);
});

await check('owner saves invoices for the firm', async () => {
  const { data, error } = await owner.supabase.from('paperwork_firm_data').upsert({ firm_id: firmId, key: 'invoices', data: { invoices: [1, 2] } }, { onConflict: 'firm_id,key' }).select('updated_at').single();
  assert.ifError(error);
  assert.ok(data.updated_at);
});

await check('a stranger sees nothing and cannot write', async () => {
  const firms = await stranger.supabase.from('paperwork_firms').select('id').eq('id', firmId);
  assert.deepEqual(firms.data, []);
  const rows = await stranger.supabase.from('paperwork_firm_data').select('key').eq('firm_id', firmId);
  assert.deepEqual(rows.data, []);
  const write = await stranger.supabase.from('paperwork_firm_data').upsert({ firm_id: firmId, key: 'kpo', data: {} }, { onConflict: 'firm_id,key' });
  assert.ok(write.error, 'stranger write must fail');
  const invite = await stranger.supabase.from('paperwork_invites').insert({ firm_id: firmId, email: stranger.email, role: 'owner' });
  assert.ok(invite.error, 'stranger cannot invite themselves');
});

await check('signed-out visitors see nothing', async () => {
  const { data } = await client().from('paperwork_firm_data').select('key');
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
    const rows = await person.supabase.from('paperwork_firm_data').select('data').eq('firm_id', firmId).eq('key', 'invoices').single();
    assert.deepEqual(rows.data.data, { invoices: [1, 2] });
  }
});

await check('the accountant can edit, but cannot invite or change roles', async () => {
  const write = await accountant.supabase.from('paperwork_firm_data').upsert({ firm_id: firmId, key: 'kpo', data: { entries: [] } }, { onConflict: 'firm_id,key' }).select('key').single();
  assert.ifError(write.error);
  const invite = await accountant.supabase.from('paperwork_invites').insert({ firm_id: firmId, email: stranger.email, role: 'viewer' });
  assert.ok(invite.error, 'accountant invite must fail');
  const promote = await accountant.supabase.from('paperwork_members').update({ role: 'owner' }).eq('firm_id', firmId).eq('user_id', accountant.id).select('role');
  assert.deepEqual(promote.data, [], 'accountant cannot promote themselves');
});

await check('the viewer can read but not write', async () => {
  const write = await viewer.supabase.from('paperwork_firm_data').update({ data: { invoices: [] } }).eq('firm_id', firmId).eq('key', 'invoices').select('key');
  assert.deepEqual(write.data, [], 'viewer update must change nothing');
  const { data } = await owner.supabase.from('paperwork_firm_data').select('data').eq('firm_id', firmId).eq('key', 'invoices').single();
  assert.deepEqual(data.data, { invoices: [1, 2] });
});

await check('the owner removes the viewer, who then loses access', async () => {
  const removed = await owner.supabase.from('paperwork_members').delete().eq('firm_id', firmId).eq('user_id', viewer.id).select('user_id');
  assert.equal(removed.data.length, 1);
  const rows = await viewer.supabase.from('paperwork_firm_data').select('key').eq('firm_id', firmId);
  assert.deepEqual(rows.data, []);
});

await check('personal rows stay private', async () => {
  const saved = await owner.supabase.from('paperwork_data').upsert({ key: 'studio.resumes.v2', data: { resumes: ['cv'] } }, { onConflict: 'user_id,key' });
  assert.ifError(saved.error);
  const other = await accountant.supabase.from('paperwork_data').select('key');
  assert.deepEqual(other.data, []);
});

console.log(`\n${passed} RLS checks passed.`);
