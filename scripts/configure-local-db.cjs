const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const cli = path.resolve(__dirname, '../node_modules/supabase/dist/supabase.js');
const settings = JSON.parse(execFileSync(process.execPath, [cli, 'status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!['localhost', '127.0.0.1'].includes(new URL(settings.API_URL).hostname) || !settings.ANON_KEY) {
  throw new Error('Expected a running local Supabase with a public anon key.');
}
const file = path.resolve(__dirname, '../.env.local');
let existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
if (existing && !existing.includes(`REACT_APP_SUPABASE_URL=${settings.API_URL}`)) {
  const backup = path.resolve(__dirname, '../supabase/.temp', `env-before-local-${Date.now()}.txt`);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.copyFileSync(file, backup);
  console.log('Previous configuration saved under supabase/.temp.');
}
existing = existing.split(/\r?\n/).filter(line => !/^(REACT_APP_SUPABASE_(URL|ANON_KEY)|NEXT_PUBLIC_SUPABASE_(URL|PUBLISHABLE_KEY))=/.test(line)).join('\n').trim();
const values = {
  REACT_APP_SUPABASE_URL: settings.API_URL,
  REACT_APP_SUPABASE_ANON_KEY: settings.ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL: settings.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: settings.ANON_KEY,
};
fs.writeFileSync(file, (existing ? existing + '\n' : '') + Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
console.log(`App configured for Docker: ${settings.API_URL}. Restart npm start or rebuild the app.`);
