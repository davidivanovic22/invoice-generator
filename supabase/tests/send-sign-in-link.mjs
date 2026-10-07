// Emails one sign-in link for the project in .env.local (creates the account if it is new).
// Opening the link in the browser that holds your data signs the app in, and it then syncs by itself.
// Run: node supabase/tests/send-sign-in-link.mjs you@example.com [http://localhost:3000]
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((match) => [match[1], match[2]])
);
const [email, app = 'http://localhost:3000'] = process.argv.slice(2);
if (!email) {
  console.error('Usage: node supabase/tests/send-sign-in-link.mjs you@example.com [app address]');
  process.exit(1);
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${app}/account` } });
console.log(error ? `FAILED: ${error.status ?? ''} ${error.message}` : `Sign-in link sent to ${email}; it opens ${app}/account`);
process.exit(error ? 1 : 0);
