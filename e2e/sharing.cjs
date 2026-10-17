// Three real browsers, explicit database firms, never automatic local imports.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const dbUrl = process.env.DATABASE_API_URL || 'http://127.0.0.1:54321';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(dbUrl).hostname), 'Sharing tests require a local database.');
const key = fs.readFileSync(path.join(__dirname, '../supabase/tests/rls.test.mjs'), 'utf8').match(/"(eyJ[^"\r\n]+)";/)[1];
const buildDir = path.join(__dirname, '../build');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  let file = path.join(buildDir, decodeURIComponent(request.url.split('?')[0]));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(buildDir, 'index.html');
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(response);
});
const stamp = Date.now();
const account = async name => {
  const db = createClient(dbUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `${name}.${stamp}@paperwork.test`;
  const result = await db.auth.signUp({ email, password: 'Lozinka123!' });
  assert.ifError(result.error);
  assert.ok(result.data.session, 'Local email confirmation must be off.');
  if (process.env.RELATIONAL_TEST_DB) {
    assert.match(process.env.RELATIONAL_TEST_DB, /^paperwork_relational_\d+$/);
    assert.match(result.data.user.id, /^[0-9a-f-]{36}$/);
    execFileSync('docker', ['exec', '-i', 'supabase_db_invoice-generator', 'psql', '-U', 'postgres', '-d', process.env.RELATIONAL_TEST_DB, '-v', 'ON_ERROR_STOP=1'], {
      input: `insert into auth.users(id,email) values('${result.data.user.id}','${email}');`, stdio: ['pipe', 'ignore', 'pipe']
    });
  }
  return { db, email, session: result.data.session };
};
const read = async (person, firmId) => {
  const result = await person.db.rpc('paperwork_read_documents', { p_firm_ids: [firmId], p_personal: false });
  assert.ifError(result.error);
  return result.data.find(row => row.key === 'invoices').data;
};
const eventually = async check => {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.fail('Database change did not arrive.');
};
(async () => {
  const owner = await account('sharing-owner');
  const accountant = await account('sharing-accountant');
  const viewer = await account('sharing-viewer');
  const created = await owner.db.rpc('paperwork_connect_firm', { p_name: 'Sharing business', p_tax_id: 'SHARING-' + stamp });
  assert.ifError(created.error);
  const firmId = created.data;
  const data = { version: 2, clients: [], profile: { party: { name: 'Sharing business' } }, invoices: [
    { id: 'shared-invoice', number: 'SHARED-2026-01', status: 'sent', issueDate: '2026-09-01', serviceDate: '2026-09-01', dueDate: '2026-12-31', currency: 'EUR', issuer: { name: 'Sharing business' }, client: { name: 'Shared client' }, items: [{ id: 'line', title: 'Work', quantity: 1, unitPrice: 100 }] }
  ] };
  assert.ifError((await owner.db.rpc('paperwork_save_document', { p_firm_id: firmId, p_key: 'invoices', p_data: data })).error);
  for (const [person, role] of [[accountant, 'accountant'], [viewer, 'viewer']]) {
    assert.ifError((await owner.db.from('paperwork_invites').insert({ firm_id: firmId, email: person.email, role })).error);
    assert.ifError((await person.db.rpc('paperwork_accept_invites')).error);
  }
  for (const person of [owner, accountant, viewer]) assert.ifError((await person.db.rpc('paperwork_select_firms', { p_firm_ids: [firmId], p_active_firm_id: firmId })).error);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL === 'chromium' ? undefined : process.env.PW_CHANNEL || 'chrome' });
  const errors = [];
  try {
    const open = async person => {
      const context = await browser.newContext();
      // Build-time configuration can override browser settings. Route every Supabase
      // request to the test endpoint before opening the page, including authentication.
      await context.route(/\/(auth|rest)\/v1\//, async route => {
        const original = new URL(route.request().url());
        const headers = { ...route.request().headers(), apikey: key };
        if (headers.authorization && headers.authorization !== `Bearer ${person.session.access_token}`) headers.authorization = `Bearer ${key}`;
        const response = await route.fetch({ url: dbUrl + original.pathname + original.search, headers });
        await route.fulfill({ response });
      });
      await context.addInitScript(({ dbUrl, key, session }) => {
        localStorage.setItem('studio.cloud', JSON.stringify({ url: dbUrl, anonKey: key }));
        localStorage.setItem('studio.cloud.session', JSON.stringify(session));
        localStorage.setItem('studio.lang', 'en');
        localStorage.setItem('studio.onboarded', '1');
      }, { dbUrl, key, session: person.session });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/invoices');
      await page.getByText('#SHARED-2026-01').waitFor();
      return page;
    };
    const ownerPage = await open(owner);
    const accountantPage = await open(accountant);
    const viewerPage = await open(viewer);
    // Keep the owner's attempted save local while a different device commits a newer revision.
    await ownerPage.route('**/rest/v1/rpc/paperwork_save_document', route => route.abort());
    const attempted = ownerPage.waitForRequest(request => request.url().includes('/rpc/paperwork_save_document'));
    await ownerPage.getByLabel('Invoice status').first().selectOption('draft');
    await attempted;
    await accountantPage.getByLabel('Invoice status').first().selectOption('paid');
    await eventually(async () => (await read(owner, firmId)).invoices[0].status === 'paid');
    await ownerPage.evaluate(() => window.dispatchEvent(new Event('focus')));
    await ownerPage.getByText('Someone else changed this data while you were working. Their version is loaded; your last changes are kept in a backup.').waitFor();
    const savedLocal = await ownerPage.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('paperwork-backups', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction('snapshots', 'readonly').objectStore('snapshots').getAll();
        read.onsuccess = () => { resolve(read.result.some(snapshot => snapshot.reason === 'before-restore' && Object.entries(snapshot.data).some(([key, raw]) => key.startsWith('studio.invoices.v2') && JSON.parse(raw).invoices?.some(invoice => invoice.id === 'shared-invoice' && invoice.status === 'draft')))); db.close(); };
        read.onerror = () => { reject(read.error); db.close(); };
      };
    }));
    assert.equal(savedLocal, true, 'Concurrent local edits must exist in the recoverable snapshot.');
    await ownerPage.unroute('**/rest/v1/rpc/paperwork_save_document');
    await ownerPage.reload();
    await assertStatus(ownerPage, 'paid');
    await viewerPage.getByText('View only:').waitFor();
    await viewerPage.getByLabel('Invoice status').first().selectOption('draft');
    await viewerPage.reload();
    await assertStatus(viewerPage, 'paid');
    assert.equal((await read(owner, firmId)).invoices[0].status, 'paid');
    const forbidden = await viewer.db.rpc('paperwork_save_document', { p_firm_id: firmId, p_key: 'invoices', p_data: { ...data, invoices: [] } });
    assert.ok(forbidden.error, 'Viewer API write must also be refused.');
    assert.deepEqual(errors, []);
    console.log('PASS: concurrent local edits backed up with visible notice, accountant edit persists, viewer UI and API cannot write.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
async function assertStatus(page, value) {
  await page.getByText('#SHARED-2026-01').waitFor();
  await eventually(async () => (await page.getByLabel('Invoice status').first().inputValue()) === value);
}
