// End-to-end smoke test of the built app (run `npm run build` first, then `npm run e2e`).
// It serves build/ itself, seeds a realistic firm and checks the flows that matter most:
// the same totals everywhere, firms kept apart, bank import, cancelling, and the phone layout.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { chromium } = require('playwright');

const buildDir = path.join(__dirname, '..', 'build');
assert.ok(fs.existsSync(path.join(buildDir, 'index.html')), 'Run `npm run build` first.');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = http.createServer((request, response) => {
  let file = path.join(buildDir, decodeURIComponent(request.url.split('?')[0]));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(buildDir, 'index.html');
  response.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(response);
});

/* ---------- Fixtures ---------- */

const party = (name, extra = {}) => ({ name, address: '', cityCountry: '', taxIdLabel: '', taxId: '', regIdLabel: '', regNo: '', email: '', ...extra });
const INVOICES = [
  ['2026-01', '2026-02-02', 3300, 'paid'],
  ['2026-02', '2026-03-02', 3300, 'paid'],
  ['2026-03', '2026-04-01', 3300, 'paid'],
  ['2026-08', '2026-09-01', 1650, 'paid'],
  ['2026-09', '2026-10-01', 3300, 'sent'],
  ['2026-10', '2026-11-02', 3300, 'draft']
];
const store = {
  version: 2,
  clients: [],
  invoices: INVOICES.map(([number, date, price, status], index) => ({
    id: `i${index}`,
    number,
    status,
    issueDate: date,
    serviceDate: date,
    dueDate: date,
    billingPeriod: '',
    currency: 'EUR',
    vatPercent: 0,
    issuer: party('Test PR', { taxId: '115410454' }),
    bank: { iban: '', swift: '', bankName: '' },
    client: party('Wisteria d.o.o.'),
    clientId: null,
    items: [{ id: `x${index}`, title: 'Usluge', description: '', quantity: 1, unit: 'month', unitPrice: price }],
    note: '',
    logo: '',
    signature: '',
    design: { template: 'modern', accentColor: '#4f46e5', language: 'sr', seasonalMonth: null, seasonalVariant: null },
    // Marked paid long after the fact, as happens when old invoices are entered.
    paidAt: status === 'paid' ? '2026-10-04' : null,
    createdAt: `${date}T08:00:00Z`,
    updatedAt: `${date}T08:00:00Z`
  })),
  profile: {
    party: party('Test PR', { taxId: '115410454', regNo: '68344956', cityCountry: 'Niš, Srbija' }),
    bank: { iban: '', swift: '', bankName: '' },
    logo: '',
    signature: '',
    yearlyTax: {},
    defaults: { currency: 'EUR', vatPercent: 0, paymentDays: 14, note: '', numberPrefix: '', language: 'sr', template: 'modern', accentColor: '#4f46e5', unit: 'h' }
  }
};

const KPO = [
  ['15.01.2026', 2206],
  ['12.02.2026', 2250],
  ['10.03.2026', 3000],
  ['14.09.2026', 1650]
];
const KPO_TOTAL = '9.106,00';

const writeFixtures = async (dir) => {
  const kpo = new ExcelJS.Workbook();
  const sheet = kpo.addWorksheet('KPO');
  sheet.addRow(['PIB:', '115410454']);
  sheet.addRow(['Obveznik:', 'Test Testić']);
  sheet.addRow([]);
  sheet.addRow(['Redni broj', 'Datum I opis knjiženja', 'PRIHOD OD DELATNOSTI', null, 'SVEGA PRIHODI OD DELATNOSTI (3+4)']);
  sheet.addRow([null, null, 'od prodaje proizvoda', 'od izvršenih usluga', null]);
  KPO.forEach(([date, amount], index) => sheet.addRow([index + 1, `Usluge računarskog programiranja (Wisteria d.o.o.) ${date}.`, 0, amount, amount]));
  await kpo.xlsx.writeFile(path.join(dir, 'kpo.xlsx'));

  const bank = new ExcelJS.Workbook();
  const statement = bank.addWorksheet('Izvod');
  statement.addRow(['Datum', 'Opis', 'Isplata', 'Uplata']);
  statement.addRow(['14.10.2026.', 'WISTERIA D.O.O. 2026-09', null, 3300]);
  statement.addRow(['15.10.2026.', 'Provizija', 12, null]);
  await bank.xlsx.writeFile(path.join(dir, 'izvod.xlsx'));
};

/* ---------- Test runner ---------- */

let passed = 0;
const step = async (title, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${title}`);
};

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paperwork-e2e-'));
  await writeFixtures(dir);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL === 'chromium' ? undefined : process.env.PW_CHANNEL || 'chrome' });
  const errors = [];
  const seed = (data) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.clear();
    localStorage.setItem('studio.lang', 'sr');
    localStorage.setItem('studio.onboarded', '1');
    localStorage.setItem('studio.invoices.v2', JSON.stringify(data));
    sessionStorage.setItem('seeded', '1');
  };
  const invoices = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('studio.invoices.v2')).invoices);

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(seed, store);
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));

    await step('importing a KPO book keeps the same total on KPO, Overview and Invoices', async () => {
      await page.goto(`${url}/kpo`);
      await page.getByRole('button', { name: 'Uvezi moju KPO knjigu' }).click();
      await page.locator('input[type=file]').setInputFiles(path.join(dir, 'kpo.xlsx'));
      await page.getByRole('button', { name: /^Uvezi \(4\)/ }).click();
      await page.getByText(`${KPO_TOTAL} €`).first().waitFor();
      // Invoices issued before the last booking are settled by the import: nothing is "missing".
      assert.equal(await page.getByText(/nije u knjizi|nisu u knjizi/).count(), 0);
      await page.goto(`${url}/overview`);
      await page.getByText(`${KPO_TOTAL} €`).first().waitFor();
      await page.goto(`${url}/invoices`);
      await page.getByText(`${KPO_TOTAL} €`).first().waitFor();
    });

    await step('a bank statement marks the invoice paid on the day the money arrived', async () => {
      await page.goto(`${url}/invoices`);
      await page.getByRole('button', { name: 'Izvod iz banke' }).click();
      await page.locator('input[type=file]').last().setInputFiles(path.join(dir, 'izvod.xlsx'));
      await page.getByRole('button', { name: /^Označi 1 fakturu/ }).click();
      await page.waitForTimeout(600);
      const invoice = (await invoices(page)).find((item) => item.number === '2026-09');
      assert.deepEqual([invoice.status, invoice.paidAt], ['paid', '2026-10-14']);
    });

    await step('an issued invoice is cancelled, not deleted', async () => {
      await page.goto(`${url}/invoices/i0`);
      await page.locator('button[aria-haspopup="menu"]').nth(2).click();
      assert.equal(await page.getByRole('menuitem', { name: 'Obriši fakturu' }).count(), 0);
      await page.getByRole('menuitem', { name: 'Storniraj fakturu' }).click();
      await page.getByRole('button', { name: 'Storniraj', exact: true }).click();
      await page.getByText('Stornirano').first().waitFor();
      await page.waitForTimeout(600); // saving is debounced
      const all = await invoices(page);
      assert.equal(all.length, INVOICES.length);
      assert.equal(all.find((item) => item.id === 'i0').status, 'cancelled');
    });

    await step('a second firm starts empty and the first keeps its data', async () => {
      await page.goto(`${url}/invoices`);
      await page.locator('button[title="Promeni firmu"]').first().click();
      await page.getByRole('menuitem', { name: 'Nova firma' }).click();
      await page.getByLabel('Naziv firme').fill('Druga firma PR');
      await page.getByRole('button', { name: 'Napravi firmu' }).click();
      await page.goto(`${url}/invoices`);
      await page.getByText('Još nema faktura').waitFor();
      await page.locator('button[title="Promeni firmu"]').first().click();
      await page.getByRole('menuitem', { name: /Test PR/ }).click();
      await page.getByText('#2026-09').waitFor();
    });

    await step('the history lists what was done', async () => {
      await page.goto(`${url}/history`);
      await page.getByText('Faktura 2026-09 označena kao Plaćena').waitFor();
      await page.getByText('Faktura 2026-01 označena kao Stornirana').waitFor();
    });

    await context.close();

    await step('no page scrolls sideways on a phone', async () => {
      const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await phone.addInitScript(seed, store);
      const mobile = await phone.newPage();
      mobile.on('pageerror', (error) => errors.push(error.message));
      for (const route of ['/', '/invoices', '/invoices/i1', '/overview', '/kpo', '/firms', '/profile', '/account', '/resumes', '/history']) {
        await mobile.goto(url + route);
        await mobile.waitForTimeout(700);
        const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 0, `${route} is ${overflow}px wider than the screen`);
      }
      await mobile.getByRole('button', { name: 'Više' }).click();
      await mobile.getByText('Nalog i backup').waitFor();
      await phone.close();
    });

    assert.deepEqual(errors, [], 'The app threw errors in the browser.');
    console.log(`\n${passed} end-to-end checks passed.`);
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
