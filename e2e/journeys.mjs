import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
let failed = 0;
const ok = (name, cond, extra = '') => (cond || failed++, console.log((cond ? 'PASS ' : 'FAIL ') + name + ' ' + extra));
const as = async (u) => {
  await page.evaluate((id) => localStorage.setItem('6d-mdu-selfcare-user', id), u);
};
const go = async (r) => {
  await page.goto(BASE + '#' + r);
  await page.waitForTimeout(800);
};
const text = () => page.locator('#main').innerText();

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload();

// Journey A: super admin creates subsidiary with invited admin, sees it in hierarchy
await as('U-100');
await go('/accounts/new?parent=ACC-1000');
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: /Business \/ Subsidiary/ }).click();
await page.getByRole('button', { name: 'Continue' }).click();
const inputs = page.locator('main input');
await inputs.nth(0).fill('6D UAE');
await inputs.nth(1).fill('DMCC-778899');
await inputs.nth(3).fill('Layla Haddad');
await inputs.nth(4).fill('layla@6dglobal.example');
await inputs.nth(6).fill('JLT Cluster X, Dubai');
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Create own billing account' }).click();
await page.getByRole('button', { name: 'Invite new administrator' }).click();
await page.locator('main input').nth(0).fill('Layla Haddad');
await page.locator('main input').nth(1).fill('layla.admin@6dglobal.example');
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Submit' }).click();
await page.waitForTimeout(1200);
ok('A: child created', (await text()).includes('Child account created'));
await page.getByRole('link', { name: 'View in hierarchy' }).click();
await page.waitForTimeout(1200);
ok('A: visible in hierarchy', (await page.locator('[role=tree]').innerText()).includes('6D UAE'));

// Journey B: branch services & billing
await go('/accounts/ACC-1120');
await page.getByRole('tab', { name: /Services/ }).click();
ok('B: branch services', (await text()).includes('Dedicated Internet Access'));
await page.getByRole('tab', { name: /Billing/ }).click();
ok('B: billed to parent', (await text()).includes('Charges billed to 6D India'));

// Journey C: PM registers MDU
await as('U-200');
await go('/mdu/new');
const ri = page.locator('main input');
await ri.nth(0).fill('Lakeview Enclave');
await ri.nth(2).fill('Hennur Road');
await ri.nth(3).fill('Bengaluru');
await ri.nth(7).fill('desk@lakeview.example');
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: /Hybrid billing/ }).click();
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Register property' }).click();
await page.waitForTimeout(1500);
ok('C: registered', (await text()).includes('Property registered'), (await text()).slice(0, 200).replace(/\n/g, ' '));
await page.getByRole('link', { name: 'Open unit grid' }).click();
await page.waitForTimeout(1200);
ok('C: units generated', (await text()).includes('A-101') && (await text()).includes('A-404'));

// Journey D: unit A-302 availability + connection
await go('/services/new?unit=PRP-GV-A-302');
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: /Check service availability/ }).click();
await page.waitForTimeout(1600);
ok('D: available', (await text()).includes('Service Available'));
await page.getByRole('button', { name: 'Continue' }).click();
await page.locator('main input[type=radio]').first().check();
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByLabel('Billing account').selectOption({ index: 1 });
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Continue' }).click();
await page.locator('main input[type=checkbox]').last().check();
await page.getByRole('button', { name: 'Submit order' }).click();
await page.waitForTimeout(1500);
ok('D: order submitted', (await text()).includes('Order submitted'));

// Journey D-neg: not-ready unit blocked
await go('/services/new?unit=PRP-GV-C-801');
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: /Check service availability/ }).click();
await page.waitForTimeout(1600);
ok('D-neg: blocked', (await text()).includes('Additional Network Work Required') && (await page.getByRole('button', { name: 'Continue', exact: true }).isDisabled()));

// Journey E: CSV partial import
await go('/mdu/import?property=PRP-GV');
await page.getByRole('button', { name: /load the demo sample/ }).click();
await page.waitForTimeout(500);
const t = await text();
ok('E: validation shown', t.includes('With errors') && t.includes('Duplicate unit in this file'));
await page.getByRole('button', { name: /Import \d+ valid row/ }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
await page.waitForTimeout(1600);
ok('E: partial success', (await text()).includes('partial success'), (await text()).match(/\d+ units created · \d+ rows rejected/)?.[0]);

// Journey F: bulk activation → operator approval → fulfilment
await go('/services/bulk?property=PRP-GV');
await page.getByRole('button', { name: 'Select all ready' }).click();
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Run availability checks' }).click();
await page.waitForTimeout(1600);
ok('F: preview', (await text()).includes('Eligible units'));
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Submit bulk request' }).click();
await page.waitForTimeout(2000);
ok('F: awaiting approval', (await text()).includes('Awaiting approval'));
const orderUrl = page.url();
await as('U-900');
await go('/approvals');
await page.getByRole('button', { name: 'Approve' }).first().click();
await page.getByRole('button', { name: 'Approve & apply' }).click();
await page.waitForTimeout(800);
await page.goto(orderUrl);
await page.waitForTimeout(800);
for (let i = 0; i < 2; i++) {
  await page.getByRole('button', { name: /Simulate next provisioning step/ }).click();
  await page.waitForTimeout(1700);
}
const ft = await text();
ok('F: fulfilled with per-unit results', /Completed\n\d+/.test(ft) || ft.includes('Completed'), ft.match(/Completed\s*\n?\s*\d+/)?.[0]);

// Journey G: consolidated billing drill-down
await as('U-103');
await go('/billing/hierarchy?focus=BA-9000');
ok('G: consolidated', (await text()).includes('Consolidated balance'));
await go('/billing/hierarchy?focus=BA-9110');
ok('G: child drill', (await text()).includes('Bangalore Office Billing'));

// Journey H: delegated admin sees only Bangalore
await as('U-102');
await go('/accounts');
const h = await text();
ok('H: only Bangalore', h.includes('Bangalore Office') && !h.includes('Hyderabad Office') && !h.includes('6D Singapore'));
await go('/accounts/ACC-1120');
ok('H: Hyderabad denied', (await text()).includes('outside your authorised scope'));
await go('/mdu');
ok('H: no MDU', (await text()).includes('Not available for your role') || (await text()).includes('property.read'));

// Journey I: resident isolation
await as('U-400');
await go('/');
ok('I: own unit', (await text()).includes('A-104'));
await go('/mdu/PRP-GV');
ok('I: property denied', (await text()).includes('Not available for your role'));
await go('/services');
const svc = await text();
ok('I: only own services', (svc.match(/SRV-/g) ?? []).length <= 2, `count=${(svc.match(/SRV-/g) ?? []).length}`);

// Cross-tenant: Palm Meadows PM cannot see Green Valley
await as('U-300');
await go('/mdu');
ok('Tenant isolation', !(await text()).includes('Green Valley') && (await text()).includes('Palm Meadows'));

console.log('page errors:', errs.length, errs.slice(0, 5).join(' | '));
await browser.close();
process.exit(failed || errs.length ? 1 : 0);
