import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://localhost:4173/';
const routes = ['/', '/home', '/accounts', '/accounts/hierarchy', '/accounts/ACC-1110', '/accounts/new', '/accounts/contacts', '/mdu', '/mdu/PRP-GV', '/mdu/units', '/mdu/occupancy', '/mdu/new', '/mdu/import', '/services', '/services/availability', '/services/new', '/services/changes', '/services/bulk', '/orders', '/billing', '/billing/hierarchy', '/billing/invoices', '/billing/allocation', '/billing/payments', '/billing/preferences', '/requests', '/requests/new', '/requests/appointments', '/users', '/users/roles', '/approvals', '/reports', '/settings', '/settings/account', '/settings/notifications', '/settings/audit', '/login', '/guide'];
const users = ['U-100', 'U-101', 'U-102', 'U-103', 'U-200', 'U-300', 'U-400', 'U-900'];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`${page.url()} :: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`${page.url()} :: console ${m.text()}`));
await page.goto(BASE);
for (const u of users) {
  await page.evaluate((id) => localStorage.setItem('6d-mdu-selfcare-user', id), u);
  for (const r of routes) {
    await page.goto(BASE + '#' + r);
    await page.waitForTimeout(650);
    const txt = await page.locator('#root').innerText();
    if (txt.length < 50) errors.push(`${u} ${r} :: empty root`);
    if (txt.includes('unexpected error')) errors.push(`${u} ${r} :: boundary: ${txt.slice(txt.indexOf('unexpected error'), txt.indexOf('unexpected error') + 160)}`);
  }
}
console.log('ERRORS', errors.length);
console.log([...new Set(errors)].slice(0, 40).join('\n'));
await browser.close();
process.exit(errors.length ? 1 : 0);
