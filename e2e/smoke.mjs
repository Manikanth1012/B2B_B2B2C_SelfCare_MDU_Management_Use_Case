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
// Duplicate-page guard: no two main destinations may render (nearly) the same content for a persona.
const DEST = ['/', '/home', '/accounts', '/accounts/hierarchy', '/accounts/contacts', '/mdu', '/mdu/occupancy', '/services', '/services/changes', '/orders', '/billing', '/billing/hierarchy', '/billing/allocation', '/billing/preferences', '/requests', '/requests/appointments', '/users', '/users/roles', '/approvals', '/reports', '/settings', '/settings/account', '/settings/notifications', '/settings/audit', '/guide'];
const words = (t) => new Set(t.toLowerCase().split(/[^a-z0-9₹$.-]+/).filter((w) => w.length > 2));
const jaccard = (a, b) => {
  let i = 0;
  a.forEach((w) => b.has(w) && i++);
  return i / (a.size + b.size - i || 1);
};
for (const u of users) {
  await page.evaluate((id) => localStorage.setItem('6d-mdu-selfcare-user', id), u);
  const seen = [];
  for (const r of DEST) {
    await page.goto(BASE + '#' + r);
    await page.waitForTimeout(650);
    const t = await page.locator('#main').innerText();
    if (t.includes('Not available for your role') || t.length < 200) continue;
    const w = words(t);
    for (const [r2, w2] of seen) {
      const sim = jaccard(w, w2);
      if (sim > 0.85) errors.push(`${u} duplicate pages ${r2} ≈ ${r} (similarity ${sim.toFixed(2)})`);
    }
    seen.push([r, w]);
  }
}
console.log('ERRORS', errors.length);
console.log([...new Set(errors)].slice(0, 40).join('\n'));
await browser.close();
process.exit(errors.length ? 1 : 0);
