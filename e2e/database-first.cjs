// Real browser + local Supabase regression for database loading and permanent firm cleanup.
// Build locally with BUILD_PATH=build-local and REACT_APP_SUPABASE_URL/ANON_KEY for local Supabase.
// Run after npm run db:start: node e2e/database-first.cjs
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const { execFileSync } = require('child_process');

const dbUrl = process.env.DATABASE_API_URL ?? 'http://127.0.0.1:54321';
// Reuse the standard local demo key from the existing local security test, never a hosted key.
const localKey = fs.readFileSync(path.join(__dirname, '../supabase/tests/rls.test.mjs'), 'utf8').match(/"(eyJ[^"\r\n]+)";/)[1];
const buildDir = process.env.E2E_BUILD_DIR || path.resolve(__dirname, '..', process.env.BUILD_DIR || 'build-local');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  let file = path.join(buildDir, decodeURIComponent(request.url.split('?')[0]));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(buildDir, 'index.html');
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(response);
});

(async () => {
  const db = createClient(dbUrl, localKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const stamp = Date.now();
  const auth = await db.auth.signUp({ email: `database-first.${stamp}@paperwork.test`, password: 'Lozinka123!' });
  assert.ifError(auth.error);
  if (process.env.RELATIONAL_TEST_DB) {
    assert.match(process.env.RELATIONAL_TEST_DB, /^paperwork_relational_\d+$/);
    assert.match(auth.data.user.id, /^[0-9a-f-]{36}$/);
    execFileSync('docker', ['exec', '-i', 'supabase_db_invoice-generator', 'psql', '-U', 'postgres', '-d', process.env.RELATIONAL_TEST_DB, '-v', 'ON_ERROR_STOP=1'], { input: `insert into auth.users(id,email) values('${auth.data.user.id}','browser-test-${auth.data.user.id}@example.test'); grant select,update,delete on paperwork_firms to authenticated;`, stdio: ['pipe', 'ignore', 'pipe'] });
  }
  const created = await db.rpc('paperwork_connect_firm', { p_name: 'Database business', p_tax_id: 'MAIN-' + stamp });
  assert.ifError(created.error);
  const keptId = created.data;
  const docs = {
    version: 2, clients: [],
    profile: { party: { name: 'Database business', taxId: 'MAIN-' + stamp }, signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==' },
    invoices: [{ id: 'db-invoice', number: 'DATABASE-2026-01', status: 'paid', issueDate: '2026-09-01', serviceDate: '2026-09-01', dueDate: '2026-09-15', currency: 'EUR', client: { name: 'Database client' }, issuer: { name: 'Database business' }, items: [{ id: 'line', title: 'Database work', quantity: 1, unitPrice: 100, unit: 'h' }] }]
  };
  assert.ifError((await db.rpc('paperwork_save_document', { p_firm_id: keptId, p_key: 'invoices', p_data: docs })).error);
  assert.ifError((await db.rpc('paperwork_save_document', { p_firm_id: keptId, p_key: 'kpo', p_data: { version: 1, entries: [{ id: 'db-kpo', date: '2026-09-01', description: 'DATABASE KPO ENTRY', services: 100, products: 0 }] } })).error);
  const unwanted = [];
  for (let index = 0; index < 2; index++) {
    const other = await db.rpc('paperwork_connect_firm', { p_name: 'Unwanted ' + index, p_tax_id: `OTHER-${stamp}-${index}` });
    assert.ifError(other.error);
    unwanted.push(other.data);
  }
  const select = async ids => {
    assert.ifError((await db.rpc('paperwork_select_firms', { p_firm_ids: ids, p_active_firm_id: keptId })).error);
  };
  await select([keptId]);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext();
    if (process.env.DATABASE_API_URL) await context.route(/\/(auth|rest)\/v1\//, async route => {
      const original = new URL(route.request().url());
      const headers = { ...route.request().headers(), apikey: localKey };
      if (headers.authorization && headers.authorization !== `Bearer ${auth.data.session.access_token}`) headers.authorization = `Bearer ${localKey}`;
      const response = await route.fetch({ url: dbUrl + original.pathname + original.search, headers });
      await route.fulfill({ response });
    });
    await context.addInitScript(({ dbUrl, localKey, session }) => {
      localStorage.setItem('studio.cloud', JSON.stringify({ url: dbUrl, anonKey: localKey }));
      localStorage.setItem('studio.cloud.session', JSON.stringify(session));
      localStorage.setItem('studio.lang', 'en');
      localStorage.setItem('studio.onboarded', '1');
      localStorage.setItem('studio.invoices.v2', JSON.stringify({ profile: { party: { name: 'OBSOLETE BROWSER BUSINESS' } }, invoices: [{ id: 'old', number: 'OBSOLETE-INVOICE' }] }));
    }, { dbUrl, localKey, session: auth.data.session });
    const page = await context.newPage();
    const errors = [];
    const automaticInserts = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/paperwork_firms')) automaticInserts.push(request.url()); });
    await page.goto(url + '/invoices');
    try { await page.getByText('#DATABASE-2026-01').waitFor(); } catch (error) { console.error('Visible app:', (await page.locator('body').innerText()).slice(0,4000)); console.error('Page errors:', JSON.stringify(errors)); throw error; }
    assert.equal(await page.getByText('#OBSOLETE-INVOICE').count(), 0);
    console.log('  ✓ database invoices populate the app despite stale browser documents');
    await page.goto(url + '/kpo');
    await page.getByText('DATABASE KPO ENTRY', { exact: true }).waitFor();
    console.log('  ✓ database KPO entries populate the app');
    await page.goto(url + '/profile');
    assert.equal(await page.getByLabel('Name or company', { exact: true }).inputValue(), 'Database business');
    await page.getByLabel('Street address', { exact: true }).fill('Database saved address');
    await assertEventually(async () => {
      const current = await db.from('paperwork_invoice_settings').select('issuer_address').eq('firm_id', keptId).single();
      return current.data?.issuer_address === 'Database saved address';
    });
    console.log('  ✓ a user edit is saved back to the database');
    await page.getByRole('radio', { name: 'sr', exact: true }).first().click();
    await page.getByRole('radio', { name: 'en', exact: true }).first().click();
    assert.equal(await page.getByLabel('Street address', { exact: true }).inputValue(), 'Database saved address');
    await page.goto(url + '/invoices/db-invoice');
    assert.equal(await page.getByText('Service date', { exact: true }).count(), 0);
    assert.equal(await page.getByLabel('Service date', { exact: true }).count(), 0);
    await page.getByRole('button', { name: /From/ }).last().click();
    await page.locator('#from').getByRole('button', { name: 'Registration number, email and more' }).click();
    await page.locator('#from').getByLabel('Label for tax ID', { exact: true }).fill('VAT identifier');
    await page.locator('#from').getByLabel('Label for reg. no.', { exact: true }).fill('Business registration');
    await assertEventually(async () => {
      const result = await db.from('paperwork_invoices').select('issuer_tax_id_label,issuer_reg_id_label').eq('firm_id', keptId).single();
      return result.data?.issuer_tax_id_label === 'VAT identifier' && result.data?.issuer_reg_id_label === 'Business registration';
    });
    await page.getByRole('button', { name: 'Remove', exact: true }).last().click();
    await assertEventually(async () => { const result = await db.from('paperwork_invoices').select('design_show_signature').eq('firm_id', keptId).single(); if (result.error) throw new Error(JSON.stringify(result.error)); return result.data?.design_show_signature === false; });
    await page.reload();
    await page.getByRole('button', { name: /From/ }).last().click();
    if (!(await page.locator('#from').getByLabel('Label for tax ID', { exact: true }).isVisible())) {
      await page.locator('#from').getByRole('button', { name: 'Registration number, email and more' }).click();
    }
    assert.equal(await page.locator('#from').getByLabel('Label for tax ID', { exact: true }).inputValue(), 'VAT identifier');
    assert.equal(await page.locator('#from').getByLabel('Label for reg. no.', { exact: true }).inputValue(), 'Business registration');
    assert.equal(await page.getByLabel('Show signature on this invoice').isChecked(), false);
    await page.getByLabel('Show signature on this invoice').check();
    await page.getByRole('button', { name: 'Redraw', exact: true }).click();
    await page.getByRole('button', { name: 'Blue ink', exact: true }).click();
    const canvas = page.locator('#from canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 90, { steps: 12 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Use this signature', exact: true }).click();
    await assertEventually(async () => (await db.from('paperwork_invoices').select('signature').eq('firm_id', keptId).single()).data?.signature?.startsWith('data:image/png'));
    assert.equal((await db.from('paperwork_invoice_settings').select('signature').eq('firm_id', keptId).single()).data?.signature, docs.profile.signature);
    assert.equal((await db.from('paperwork_kpo_entries').select('id').eq('firm_id', keptId)).data.length, 1);
    console.log('  PASS: language changes, signature removal and blue ink preserve database documents');
    await page.goto(url + '/account');
    await page.getByLabel('First name', { exact: true }).fill('Browser');
    await page.getByLabel('Last name', { exact: true }).fill('Person');
    await page.getByLabel('Username', { exact: true }).fill('browser_' + stamp);
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.getByText('Profile saved.', { exact: true }).waitFor();
    await page.reload();
    await assertEventually(async () => await page.getByLabel('First name', { exact: true }).inputValue() === 'Browser');
    console.log('  PASS: account profile saves to separate columns and survives reload');
    await select([keptId, ...unwanted]);
    await page.goto(url + '/firms');
    await page.getByText('Unwanted 1', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Keep only this firm', exact: true }).first().click();
    await assertEventually(async () => {
      const firms = await db.from('paperwork_firms').select('id');
      return firms.data?.length === 1 && firms.data[0].id === keptId;
    });
    for (let index = 0; index < 3; index++) {
      await page.reload();
      await page.getByRole('button', { name: 'Keep only this firm', exact: true }).waitFor();
      assert.equal(await page.getByText('Unwanted 1', { exact: true }).count(), 0);
      const firms = await db.from('paperwork_firms').select('id');
      assert.deepEqual(firms.data, [{ id: keptId }]);
    }
    assert.deepEqual(automaticInserts, []);
    assert.deepEqual(errors, []);
    const main = await db.from('paperwork_invoices').select('id').eq('firm_id', keptId);
    assert.equal(main.data[0].id, 'db-invoice');
    console.log('  ✓ cleanup preserves the chosen firm and its documents; 3 reloads recreate nothing');
    const restoredInvoice = { ...docs.invoices[0], id: 'restored-invoice', number: 'RESTORED-2026-01', clientId: 'restored-client' };
    const backup = { app: 'paperwork', version: 1, data: {
      'studio.invoices.v2': { ...docs, invoices: [restoredInvoice], clients: [{ id: 'restored-client', party: restoredInvoice.client, currency: 'EUR', lastUsedAt: '' }] },
      'studio.kpo.v1': { version: 1, entries: [{ id: 'restored-kpo', date: '2026-09-01', description: 'RESTORED KPO ENTRY', services: 100, products: 0, source: 'invoice', invoiceId: 'restored-invoice' }] },
      'studio.resumes.v2': { version: 2, resumes: [{ id: 'restored-cv', name: 'Restored CV', personal: { fullName: 'Example Person' }, sections: [] }] }
    } };
    await page.goto(url + '/account');
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Restore from file', exact: true }).click();
    await (await chooserPromise).setFiles({ name: 'legacy-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.getByRole('button', { name: 'Restore', exact: true }).last().click();
    await assertEventually(async () => {
      const clients = await db.from('paperwork_clients').select('id').eq('firm_id', keptId);
      return clients.data?.[0]?.id === 'restored-client';
    });
    assert.equal((await db.from('paperwork_kpo_entries').select('invoice_id').eq('firm_id', keptId)).data[0].invoice_id, 'restored-invoice');
    assert.equal((await db.from('paperwork_resumes').select('id')).data[0].id, 'restored-cv');
    assert.deepEqual((await db.from('paperwork_firms').select('id')).data, [{ id: keptId }]);
    await page.goto(url + '/invoices');
    await page.getByText('#RESTORED-2026-01').waitFor();
    await page.reload();
    await page.getByText('#RESTORED-2026-01').waitFor();
    console.log('  ✓ explicit legacy file restore populates clients, invoices, KPO and CV rows in the chosen existing firm');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.message); server.close(); process.exitCode = 1; });

async function assertEventually(check) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.fail('Database change did not complete');
}
