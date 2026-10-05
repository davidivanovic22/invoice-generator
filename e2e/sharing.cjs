// End-to-end test of sharing a firm through the cloud, with three people in three browsers.
// Needs the build (`npm run build`) and a local Supabase (`npm run db:start`), then `npm run e2e:sharing`.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
// The well-known demo key of every local Supabase; never valid for a hosted project.
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const buildDir = path.join(__dirname, '..', 'build');
assert.ok(fs.existsSync(path.join(buildDir, 'index.html')), 'Run `npm run build` first.');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = http.createServer((request, response) => {
  let file = path.join(buildDir, decodeURIComponent(request.url.split('?')[0]));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(buildDir, 'index.html');
  response.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(response);
});

const party = (name) => ({ name, address: '', cityCountry: '', taxIdLabel: '', taxId: '', regIdLabel: '', regNo: '', email: '' });
const store = {
  version: 2,
  clients: [],
  invoices: [['2026-01', 'paid'], ['2026-02', 'sent']].map(([number, status], index) => ({
    id: `i${index}`,
    number,
    status,
    issueDate: '2026-09-01',
    serviceDate: '2026-09-01',
    dueDate: '2026-12-31',
    billingPeriod: '',
    currency: 'EUR',
    vatPercent: 0,
    issuer: party('Vlasnik PR'),
    bank: { iban: '', swift: '', bankName: '' },
    client: party('Wisteria d.o.o.'),
    clientId: null,
    items: [{ id: `x${index}`, title: 'Usluge', description: '', quantity: 1, unit: 'month', unitPrice: 1000 }],
    note: '',
    logo: '',
    signature: '',
    design: { template: 'modern', accentColor: '#4f46e5', language: 'sr', seasonalMonth: null, seasonalVariant: null },
    paidAt: status === 'paid' ? '2026-09-10' : null,
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z'
  })),
  profile: {
    party: party('Vlasnik PR'),
    bank: { iban: '', swift: '', bankName: '' },
    logo: '',
    signature: '',
    yearlyTax: {},
    defaults: { currency: 'EUR', vatPercent: 0, paymentDays: 14, note: '', numberPrefix: '', language: 'sr', template: 'modern', accentColor: '#4f46e5', unit: 'h' }
  }
};

let passed = 0;
const step = async (title, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${title}`);
};

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL === 'chromium' ? undefined : process.env.PW_CHANNEL || 'chrome' });
  const stamp = Date.now();
  const mail = (name) => `${name}.${stamp}@paperwork.test`;
  const errors = [];

  /** A person with their own browser. `data` seeds the first firm. */
  const person = async (name, data) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript((seed) => {
      if (sessionStorage.getItem('seeded')) return;
      localStorage.clear();
      localStorage.setItem('studio.lang', 'sr');
      localStorage.setItem('studio.onboarded', '1');
      if (seed) localStorage.setItem('studio.invoices.v2', JSON.stringify(seed));
      sessionStorage.setItem('seeded', '1');
    }, data || null);
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
    // Connect the project and create the account.
    await page.goto(`${url}/account#cloud`);
    const cloud = page.locator('#cloud');
    await cloud.getByLabel('Project URL').fill(SUPABASE_URL);
    await cloud.getByLabel('anon public key').fill(ANON_KEY);
    await cloud.getByRole('button', { name: 'Poveži projekat' }).click();
    await cloud.getByRole('radio', { name: 'Napravi nalog' }).click();
    await cloud.getByLabel('Email').fill(mail(name));
    await cloud.getByLabel('Lozinka', { exact: true }).fill('Lozinka123!');
    await cloud.getByRole('button', { name: 'Napravi nalog' }).last().click();
    await page.waitForTimeout(5000);
    return page;
  };
  const firms = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('studio.firms') || '{"firms":[]}').firms);
  const openShared = async (page, role) => {
    const shared = (await firms(page)).find((firm) => firm.role === role);
    assert.ok(shared, `${role} did not receive the firm`);
    await page.evaluate((id) => {
      const registry = JSON.parse(localStorage.getItem('studio.firms'));
      registry.activeId = id;
      localStorage.setItem('studio.firms', JSON.stringify(registry));
    }, shared.id);
    await page.goto(`${url}/invoices`);
    await page.getByText('#2026-02').waitFor();
    return shared;
  };
  const sync = async (page) => {
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(5000);
  };

  try {
    const owner = await person('vlasnik', store);

    await step('the owner signs in and the firm is shared to the cloud', async () => {
      const [firm] = await firms(owner);
      assert.equal(firm.role, 'owner');
      assert.ok(firm.cloudId);
    });

    await step('the owner invites an accountant and a viewer', async () => {
      await owner.goto(`${url}/firms`);
      await owner.getByRole('button', { name: 'Ljudi i uloge' }).first().click();
      await owner.getByLabel('Pozovi mejlom').fill(mail('knjigovodja'));
      await owner.getByRole('button', { name: 'Pozovi', exact: true }).click();
      await owner.getByText('Pozvan · Knjigovođa').waitFor();
      await owner.getByLabel('Pozovi mejlom').fill(mail('gledalac'));
      await owner.getByRole('button', { name: /^Samo pregled/ }).click();
      await owner.getByRole('button', { name: 'Pozovi', exact: true }).click();
      await owner.getByText('Pozvan · Samo pregled').waitFor();
    });

    const accountant = await person('knjigovodja');
    await step('the accountant gets the firm and can change it; the owner sees the change and who made it', async () => {
      await openShared(accountant, 'accountant');
      await accountant.getByLabel('Status fakture').first().selectOption('paid');
      await accountant.waitForTimeout(6000);
      await sync(owner);
      const invoices = await owner.evaluate(() => JSON.parse(localStorage.getItem('studio.invoices.v2')).invoices);
      assert.ok(invoices.every((invoice) => invoice.status === 'paid'), 'the owner did not receive the change');
      await owner.goto(`${url}/history`);
      await owner.getByText(mail('knjigovodja')).first().waitFor();
    });

    const viewer = await person('gledalac');
    await step('the viewer sees the firm but cannot change it', async () => {
      const shared = await openShared(viewer, 'viewer');
      await viewer.getByText('Samo pregled:').waitFor();
      const before = await viewer.evaluate((key) => localStorage.getItem(key), `studio.invoices.v2@${shared.id}`);
      await viewer.getByLabel('Status fakture').first().selectOption('draft');
      await viewer.getByText('Ovu firmu možeš samo da pregledaš').waitFor();
      await viewer.waitForTimeout(4000);
      assert.equal(await viewer.evaluate((key) => localStorage.getItem(key), `studio.invoices.v2@${shared.id}`), before, 'the viewer changed local data');
      await sync(owner);
      const invoices = await owner.evaluate(() => JSON.parse(localStorage.getItem('studio.invoices.v2')).invoices);
      assert.ok(invoices.every((invoice) => invoice.status === 'paid'), "the viewer's change reached the owner");
    });

    assert.deepEqual(errors, [], 'The app threw errors in the browser.');
    console.log(`\n${passed} sharing checks passed.`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
