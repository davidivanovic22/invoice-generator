// Safe check of a hosted Supabase project: creates nothing. As a signed-out visitor it confirms that
// the Paperwork tables exist, that nothing can be read, and that writes are refused.
// Run: npm run db:check   (reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from .env.local)
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = Object.fromEntries(
  (fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^["']|["']$/g, '')])
);
const url = process.env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.REACT_APP_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.REACT_APP_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Put NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local first.');
  process.exit(1);
}
if (/secret|service_role/i.test(key)) {
  console.error('That looks like a secret key. Use the publishable (anon) key.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0;
const report = (ok, text) => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? '✓' : '✗'} ${text}`);
};

console.log(`Project: ${url}`);
for (const table of ['paperwork_data', 'paperwork_firms', 'paperwork_members', 'paperwork_invites', 'paperwork_firm_data']) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) report(false, `${table}: ${error.message}`);
  else report(data.length === 0, `${table} exists and a signed-out visitor reads ${data.length === 0 ? 'nothing' : 'ROWS (not protected!)'}`);
}

const id = crypto.randomUUID();
const firm = await supabase.from('paperwork_firms').insert({ id, name: 'check' });
report(Boolean(firm.error), `a signed-out visitor cannot create a firm${firm.error ? '' : ' — IT WAS CREATED'}`);
const data = await supabase.from('paperwork_firm_data').insert({ firm_id: id, key: 'invoices', data: {} });
report(Boolean(data.error), 'a signed-out visitor cannot write firm data');
const personal = await supabase.from('paperwork_data').insert({ key: 'studio.resumes.v2', data: {} });
report(Boolean(personal.error), 'a signed-out visitor cannot write personal data');

const invites = await supabase.rpc('paperwork_accept_invites');
report(Boolean(invites.error) || invites.data === 0, 'accepting invites does nothing for a signed-out visitor');

const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }).then((response) => response.json()).catch(() => null);
if (settings) {
  report(settings.external?.email === true, 'email sign-in is enabled');
  console.log(`  · confirm email before first sign-in: ${settings.mailer_autoconfirm ? 'OFF (anyone can sign up with any address)' : 'on'}`);
  console.log(`  · new sign-ups allowed: ${settings.disable_signup ? 'no' : 'yes'}`);
}

console.log(failed ? `\n${failed} problem(s) found.` : '\nThe project is set up correctly.');
process.exit(failed ? 1 : 0);
