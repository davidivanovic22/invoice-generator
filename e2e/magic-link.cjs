// End-to-end test of signing in by email link against a local Supabase (`npm run db:start`).
// Build the app against it first:
//   BUILD_PATH=build-local REACT_APP_SUPABASE_URL=http://127.0.0.1:54321 REACT_APP_SUPABASE_ANON_KEY=<local anon key> npx react-scripts build
// It checks the migration path for existing users: data that was only in the browser is pushed to
// the database as soon as the emailed link is opened — also when the app is locked with a password.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const MAILPIT = 'http://127.0.0.1:54324';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const PORT = 4173;
const APP = `http://127.0.0.1:${PORT}`;

const buildDir = path.join(__dirname, '..', 'build-local');
assert.ok(fs.existsSync(path.join(buildDir, 'index.html')), 'Build the app against the local Supabase first (see the top of this file).');
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
  invoices: ['2026-01', '2026-02', '2026-03'].map((number, index) => ({
    id: `i${index}`,
    number,
    status: 'paid',
    issueDate: '2026-09-01',
    serviceDate: '2026-09-01',
    dueDate: '2026-09-15',
    billingPeriod: '',
    currency: 'EUR',
    vatPercent: 0,
    issuer: party('Test PR'),
    bank: { iban: '', swift: '', bankName: '' },
    client: party('Wisteria d.o.o.'),
    clientId: null,
    items: [{ id: `x${index}`, title: 'Usluge', description: '', quantity: 1, unit: 'month', unitPrice: 1000 }],
    note: '',
    logo: '',
    signature: '',
    design: { template: 'modern', accentColor: '#4f46e5', language: 'sr', seasonalMonth: null, seasonalVariant: null },
    paidAt: '2026-09-10',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z'
  })),
  profile: {
    party: party('Test PR'),
    bank: { iban: '', swift: '', bankName: '' },
    logo: '',
    signature: '',
    yearlyTax: {},
    defaults: { currency: 'EUR', vatPercent: 0, paymentDays: 14, note: '', numberPrefix: '', language: 'sr', template: 'modern', accentColor: '#4f46e5', unit: 'h' }
  }
};
const kpo = { version: 1, currency: 'EUR', header: {}, entryTemplate: 'Usluge ({client})', bookOn: 'paid', settledInvoiceIds: [], entries: [{ id: 'k1', date: '2026-01-15', description: 'Usluge (Wisteria d.o.o.)', products: 0, services: 2206, source: 'import', invoiceId: null }] };

/** The sign-in link from the newest email to this address (Mailpit catches local mail). */
const linkFor = async (email) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    if (list.messages?.length) {
      const message = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      const match = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(message.HTML) || /(http\S*\/auth\/v1\/verify\S*)/.exec(message.Text);
      if (match) return match[1].replace(/&amp;/g, '&');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No sign-in email arrived for ${email}`);
};

let passed = 0;
const step = async (title, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${title}`);
};

(async () => {
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL === 'chromium' ? undefined : process.env.PW_CHANNEL || 'chrome' });
  const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const errors = [];

  /** A browser that already holds data, like an existing user's. */
  const existingUser = async (locked) => {
    const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
    // Seed before the app first loads (once per browser), so the app starts with this data.
    await context.addInitScript(
      ([invoices, book]) => {
        if (localStorage.getItem('e2e.seeded')) return;
        localStorage.clear();
        localStorage.setItem('e2e.seeded', '1');
        localStorage.setItem('studio.lang', 'sr');
        localStorage.setItem('studio.onboarded', '1');
        localStorage.setItem('studio.invoices.v2', JSON.stringify(invoices));
        localStorage.setItem('studio.kpo.v1', JSON.stringify(book));
      },
      [store, kpo]
    );
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${APP}/account`);
    if (locked) {
      // Turn on the app lock through the UI, as the user did.
      await page.getByLabel('Tvoje ime').fill('Test');
      await page.getByLabel('Lozinka', { exact: true }).first().fill('tajna123');
      await page.getByLabel('Ponovi lozinku').fill('tajna123');
      await page.getByRole('button', { name: 'Uključi lozinku' }).click();
      await page.getByText('Sačuvaj kod za oporavak').waitFor();
    }
    return { context, page };
  };

  try {
    await step('opening the emailed link signs in and pushes the browser data to the database', async () => {
      const email = `link.${Date.now()}@paperwork.test`;
      const { context, page } = await existingUser(false);
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${APP}/account` } });
      assert.ifError(error);
      await page.goto(await linkFor(email));
      await page.getByText(`Prijavljen kao ${email}`).waitFor({ timeout: 20000 });
      await page.getByText(/^Sinhronizovano/).first().waitFor({ timeout: 20000 });
      const firms = await page.evaluate(() => JSON.parse(localStorage.getItem('studio.firms')).firms);
      assert.equal(firms.length, 1);
      assert.equal(firms[0].role, 'owner');
      // The session in the browser can read its own rows.
      const rows = await page.evaluate(
        async ([url, key, cloudId]) => {
          const session = JSON.parse(localStorage.getItem('studio.cloud.session'));
          const response = await fetch(`${url}/rest/v1/paperwork_firm_data?firm_id=eq.${cloudId}&select=key,data`, { headers: { apikey: key, Authorization: `Bearer ${session.access_token}` } });
          return response.json();
        },
        [SUPABASE_URL, ANON_KEY, firms[0].cloudId]
      );
      const byKey = Object.fromEntries(rows.map((row) => [row.key, row.data]));
      assert.equal(byKey.invoices.invoices.length, 3, 'invoices were not pushed');
      assert.equal(byKey.kpo.entries.length, 1, 'the KPO book was not pushed');
      await context.close();
    });

    await step('it also works when the app is locked: unlock, then it signs in and syncs', async () => {
      const email = `locked.${Date.now()}@paperwork.test`;
      const { context } = await existingUser(true);
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${APP}/account` } });
      assert.ifError(error);
      // The link opens in a new tab, which starts locked.
      const tab = await context.newPage();
      tab.on('pageerror', (failure) => errors.push(failure.message));
      await tab.goto(await linkFor(email));
      await tab.getByText('Unesi lozinku da otvoriš Paperwork.').waitFor({ timeout: 20000 });
      await tab.getByLabel('Lozinka').fill('tajna123');
      await tab.getByRole('button', { name: 'Otključaj' }).click();
      await tab.getByText(`Prijavljen kao ${email}`).waitFor({ timeout: 20000 });
      await tab.getByText(/^Sinhronizovano/).first().waitFor({ timeout: 20000 });
      await context.close();
    });

    assert.deepEqual(errors, [], 'The app threw errors in the browser.');
    console.log(`\n${passed} sign-in link checks passed.`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
