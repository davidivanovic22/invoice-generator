// Run against an isolated database created by supabase/tests/relational.test.py.
// RELATIONAL_TEST_DB=paperwork_relational_<stamp> node e2e/relational.cjs
// Local auth is proxied unchanged; document requests go only to the isolated database.
const { execFileSync, spawnSync } = require('child_process');
const http = require('http');
const path = require('path');
const assert = require('node:assert/strict');

const database = process.env.RELATIONAL_TEST_DB;
assert.match(database ?? '', /^paperwork_relational_\d+$/);
const config = JSON.parse(execFileSync('docker', ['inspect', 'supabase_rest_invoice-generator'], { encoding: 'utf8' }))[0];
const network = Object.keys(config.NetworkSettings.Networks)[0];
const env = config.Config.Env.filter(value => value.startsWith('PGRST_')).map(value => value.startsWith('PGRST_DB_URI=') ? value.replace(/\/postgres(?:\?.*)?$/, '/' + database) : value);
const args = ['run', '--rm', '-d', '--network', network, '-p', '127.0.0.1:54332:3000'];
env.forEach(value => args.push('-e', value));
args.push('-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_EXTRA_SEARCH_PATH=public');
args.push(config.Image);
const container = execFileSync('docker', args, { encoding: 'utf8' }).trim();
const proxy = http.createServer((request, response) => {
  const rest = request.url.startsWith('/rest/v1/');
  const target = rest ? new URL(request.url.slice('/rest/v1'.length), 'http://127.0.0.1:54332') : new URL(request.url, 'http://127.0.0.1:54321');
  const upstream = http.request(target, { method: request.method, headers: { ...request.headers, host: target.host } }, reply => {
    response.writeHead(reply.statusCode, reply.headers); reply.pipe(response);
  });
  upstream.on('error', () => { response.writeHead(502); response.end(); });
  request.pipe(upstream);
});
(async () => {
  await new Promise(resolve => proxy.listen(54331, '127.0.0.1', resolve));
  const localKey = require('fs').readFileSync(path.join(__dirname, '../supabase/tests/rls.test.mjs'), 'utf8').match(/"(eyJ[^"\r\n]+)";/)[1];
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch('http://127.0.0.1:54331/rest/v1/paperwork_firms?select=id', { headers: { apikey: localKey, Authorization: `Bearer ${localKey}` } }).catch(() => null);
    if (response?.ok) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) {
    console.error(execFileSync('docker', ['logs', container, '--tail', '8'], { encoding: 'utf8' }));
    throw new Error('The isolated REST database did not become ready.');
  }
  const result = await new Promise(resolve => {
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, [path.join(__dirname, 'database-first.cjs')], { stdio: 'inherit', env: { ...process.env, DATABASE_API_URL: 'http://127.0.0.1:54331', E2E_BUILD_DIR: path.join(__dirname, '../build') } });
    child.on('close', resolve);
  });
  process.exitCode = result;
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  await new Promise(resolve => proxy.close(resolve));
  spawnSync('docker', ['stop', container], { stdio: 'ignore' });
});
