/*
 * Generates PDF bills in the 6D invoice template for the invoices shown on
 * Bills & Payments to selected personas, from the same deterministic seed the
 * app uses, so every figure matches the portal.
 *
 *   node scripts/bills/generate-bills.mjs                 # all bills for the configured personas
 *   node scripts/bills/generate-bills.mjs INV-7001-202610 # just one bill
 *
 * Output: public/bills/<invoiceId>.pdf and src/data/billPdfs.ts (the list of
 * invoices that have a PDF, used by the Download buttons).
 * Set CHROME_PATH if Playwright cannot find Chromium.
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import QRCode from 'qrcode';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PERSONAS = ['U-200', 'U-400']; // Priya Menon (property manager), Sneha Kulkarni (resident)
const TAX_RATE = 0.18; // invoice amounts in the portal are tax-inclusive
const only = process.argv.slice(2);

/* ---------- load the app's seed + scope rules ---------- */
const entry = join(tmpdir(), `bills-entry-${process.pid}.ts`);
const bundle = join(tmpdir(), `bills-seed-${process.pid}.mjs`);
writeFileSync(entry, `export { buildSeed } from ${JSON.stringify(join(ROOT, 'src/data/seed.ts'))};\nexport { resolveScope } from ${JSON.stringify(join(ROOT, 'src/api/scope.ts'))};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error' });
const { buildSeed, resolveScope } = await import(pathToFileURL(bundle).href);
const db = buildSeed();

/* ---------- helpers ---------- */
const b64 = (p) => readFileSync(p).toString('base64');
const font = (w) => `@font-face{font-family:Montserrat;font-weight:${w};src:url(data:font/woff2;base64,${b64(join(ROOT, `node_modules/@fontsource/montserrat/files/montserrat-latin-${w}-normal.woff2`))}) format('woff2')}`;
const LOGO = `data:image/png;base64,${b64(join(ROOT, 'public/brand/6d-logo.png'))}`;
const MARK = `data:image/png;base64,${b64(join(ROOT, 'scripts/bills/6d-mark-512.png'))}`;
// Payment-channel and info icons, taken from the reference 6D invoice template.
const ICON = Object.fromEntries(['online', 'store', 'upi', 'info'].map((n) => [n, `data:image/png;base64,${b64(join(ROOT, `scripts/bills/icon-${n}.png`))}`]));
const usd = (n) => (Math.round(n * 100) / 100).toFixed(2);
const d = (iso) => new Date(iso + 'T00:00:00Z');
const ddmmyy = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}`;
const long = (iso) => d(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dow = (iso) => d(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', timeZone: 'UTC' }).replace(',', '');
const monthEnd = (period) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const mon = (period) => d(period + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace(' ', '-');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const digitsOf = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString().padStart(10, '0').slice(0, 10);

/* ---------- which invoices: exactly what each persona sees on Bills & Payments ---------- */
const targets = [];
for (const uid of PERSONAS) {
  const user = db.users.find((u) => u.id === uid);
  const scope = resolveScope(db, user);
  const accounts = db.billingAccounts.filter((b) => scope.billing.has(b.id) && (b.type !== 'Resident' || scope.customerId));
  for (const inv of db.invoices.filter((i) => accounts.some((b) => b.id === i.billingAccountId))) targets.push({ inv, user });
}

/* ---------- per-invoice model ---------- */
function model(inv, user) {
  const ba = db.billingAccounts.find((b) => b.id === inv.billingAccountId);
  const history = db.invoices.filter((i) => i.billingAccountId === ba.id).sort((a, b) => a.period.localeCompare(b.period));
  const prev = history.filter((i) => i.period < inv.period).pop();
  const payments = db.payments.filter((p) => p.billingAccountId === ba.id && p.date <= inv.issueDate).sort((a, b) => b.date.localeCompare(a.date));
  const paidLastMonth = prev ? payments.filter((p) => p.invoiceId === prev.id).reduce((a, p) => a + p.amount, 0) : 0;
  const services = db.services.filter((s) => s.billingAccountId === ba.id && s.status !== 'Terminated');
  let name, addressLines, attn;
  if (ba.payerRef.kind === 'customer') {
    const c = db.customers.find((x) => x.id === ba.payerRef.id);
    const occ = db.occupancies.find((o) => o.customerId === c.id && !o.validTo);
    const unit = occ && db.units.find((u) => u.id === occ.unitId);
    const prop = unit && db.properties.find((p) => p.id === unit.propertyId);
    const bld = unit && db.buildings.find((b) => b.id === unit.buildingId);
    name = `Ms ${c.name}`;
    addressLines = unit ? [`${unit.number}, ${bld.name}, ${prop.name},`, `${prop.address}, ${prop.city}`] : ['—'];
  } else {
    const prop = db.properties.find((p) => p.id === ba.payerRef.id);
    const mgr = db.users.find((u) => u.id === prop.managerUserId);
    name = `${prop.name}`;
    attn = `c/o ${prop.managementOrg} · Attn: ${mgr?.name ?? ''}`;
    addressLines = [`${prop.address},`, `${prop.city}`];
  }
  // Split each tax-inclusive line into net + tax, keeping totals exact.
  const gross = inv.amount;
  const net = Math.round((gross / (1 + TAX_RATE)) * 100) / 100;
  const tax = Math.round((gross - net) * 100) / 100;
  const scale = net / gross;
  const lines = inv.lines.map((l) => {
    const srv = l.serviceId && db.services.find((s) => s.id === l.serviceId);
    const off = srv && db.offerings.find((o) => o.id === srv.offeringId);
    const unit = srv?.unitId && db.units.find((u) => u.id === srv.unitId);
    return {
      usage: !l.serviceId,
      description: l.description,
      serviceNo: srv ? (off.category === 'Mobile' ? srv.location.replace('Mobile ', '') : srv.id) : '—',
      where: unit ? unit.number : l.costCentre,
      plan: off ? off.name : l.description,
      net: Math.round(l.amount * scale * 100) / 100,
    };
  });
  const drift = Math.round((net - lines.reduce((a, l) => a + l.net, 0)) * 100) / 100;
  if (lines.length) lines[lines.length - 1].net = Math.round((lines[lines.length - 1].net + drift) * 100) / 100;
  const monthly = lines.filter((l) => !l.usage).reduce((a, l) => a + l.net, 0);
  const usage = lines.filter((l) => l.usage).reduce((a, l) => a + l.net, 0);
  const prevBal = prev ? prev.amount : 0;
  const totalPayable = prevBal - paidLastMonth + gross;
  const isMobile = services.some((s) => db.offerings.find((o) => o.id === s.offeringId)?.category === 'Mobile');
  return {
    inv, ba, user, name, attn, addressLines, services, lines, monthly, usage, net, tax, gross, isMobile,
    prevBal, paidLastMonth, totalPayable,
    from: inv.period + '-01', to: monthEnd(inv.period),
    history: history.filter((i) => i.period <= inv.period).slice(-6),
    lastPayments: payments.slice(0, 3),
    acct: digitsOf(ba.id),
  };
}

/* ---------- template (mirrors the 6D JasperReports invoice) ---------- */
const CSS = `
${[400, 500, 600, 700].map(font).join('\n')}
@page{size:A4;margin:12mm 0}
@page:first{margin:0}
*{box-sizing:border-box}
body{margin:0;font-family:Montserrat,Arial,sans-serif;color:#111;font-size:8.6pt}
.p1{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always}
.band{background:#F2F2F2;margin:0 12mm;height:41mm;display:flex;align-items:center;justify-content:center}
.band img{height:22mm}
.cust{display:grid;grid-template-columns:1.3fr 1fr 1.4fr;margin:3mm 12mm 0}
.cust>div{padding:0 3mm 4mm}
.cust>div+div{border-left:0.6pt solid #CFCFCF}
.cust h1{font-size:12.5pt;margin:0 0 2.5mm;font-weight:600}
.addr{font-size:7.6pt;font-weight:600;line-height:1.45}
.kv{display:grid;grid-template-columns:auto 1fr;column-gap:2mm;font-size:7pt;line-height:1.55;white-space:nowrap}
.kv b{font-weight:700}
.sumrow{display:flex;gap:4mm;margin:6mm 13mm 0;align-items:stretch}
.sum{background:#E9E9E9;border-radius:3mm;flex:1;display:grid;grid-template-columns:1fr 4mm 1fr 4mm 1fr 4mm 1.3fr;padding:4mm 2mm}
.sum .c{padding:0 1mm 0 2mm;font-size:7pt;color:#555;line-height:1.3;display:flex;flex-direction:column}
.sum .c .v{font-size:8.4pt;color:#111;margin-top:auto;padding-top:3mm;white-space:nowrap}
.op{align-self:end;text-align:center;font-size:10pt;color:#555}
.eq{align-self:center;font-size:12pt;color:#555}
.pay{background:#E9E9E9;border-radius:3mm;width:60mm;display:grid;grid-template-columns:1fr 1fr;padding:4mm 3mm}
.pay .c{padding:0 2mm;font-size:7.6pt;color:#555}
.pay .big{font-size:10.5pt;color:#111;font-weight:600;margin-top:3mm;white-space:nowrap}
.pay .big.long{font-size:8.6pt}
.pay .tiny{font-size:5.2pt;color:#555;margin-top:1.5mm}
.note{display:flex;gap:2.5mm;margin:5mm 15mm 0;font-size:6.6pt;font-weight:600;line-height:1.5;align-items:flex-start}
.note .i{width:4.6mm;height:4.6mm;flex:none}
.lower{display:grid;grid-template-columns:1fr 1fr;gap:9mm;margin:5mm 13mm 0;align-items:start}
.cs{width:100%;border-collapse:collapse;font-size:7.4pt}
.cs th{text-align:left;font-size:9pt;padding:1.5mm 2.5mm 2.5mm;font-weight:700;white-space:nowrap}
.cs th:last-child{text-align:left}
.cs td{padding:2mm 2.5mm;font-weight:600}
.cs td:last-child{text-align:right;font-weight:500}
.cs tr:nth-child(odd) td{background:#F1F1F1}
.cs .sub td:first-child{padding-left:8mm;font-weight:500}
.cs .tot td{font-weight:700}
.ways{border:0.6pt solid #CFCFCF;border-radius:2mm;padding:3mm 4mm}
.ways h3{margin:0 0 3mm;font-size:8pt;font-weight:500}
.icons{display:flex;gap:7mm;align-items:center;font-size:6.6pt;font-weight:700;line-height:1.25}
.icons span{display:flex;align-items:center;gap:1.5mm}
.ico{height:6.5mm;width:auto}
.pmt{display:grid;grid-template-columns:1fr 1fr;gap:4mm;font-size:6.4pt;font-weight:600;margin-top:4mm;line-height:1.5}
.qr{border:0.6pt solid #CFCFCF;border-radius:2mm;width:40mm;margin:3mm 0 0 auto;padding:2.5mm;font-size:6.2pt;font-weight:700}
.qr img{width:31mm;display:block;margin:1.5mm auto 0}
.markbox{border:0.6pt solid #CFCFCF;border-radius:2.5mm;height:48mm;margin-top:4mm;display:flex;align-items:center;justify-content:center}
.markbox img{height:44mm}
.foot{position:absolute;left:0;right:0;bottom:0;height:27mm;background:#E5E5E5;text-align:center;font-size:6.8pt;font-weight:600;padding-top:3mm}
.flow{padding:0 13mm}
.flow h1{font-size:17pt;font-weight:700;margin:2mm 0 6mm}
.flow h2{font-size:10pt;margin:0 0 3mm;font-weight:700}
.meta{display:grid;grid-template-columns:repeat(3,1fr);border-top:0.6pt solid #DDD;border-bottom:0.6pt solid #DDD;margin-bottom:3mm}
.meta>div{padding:2mm 2mm 2mm 0;font-size:7.8pt}
.meta>div+div{border-left:0.6pt solid #DDD;padding-left:3mm}
.meta b{display:block;font-size:6.3pt;margin-bottom:1mm}
.small{font-size:6.6pt;font-weight:600;line-height:1.45}
.dep{background:#EFEFEF;border-radius:3mm;display:grid;grid-template-columns:52mm 1fr;padding:4mm 4mm;margin:3mm 0;font-size:6.8pt;font-weight:600}
.dep .v{font-size:12pt;margin-top:3mm;font-weight:500}
.hist{display:grid;grid-template-columns:1.9fr 1fr;gap:5mm;margin-top:2mm}
.hist .box{background:#F2F2F2;border-radius:1.5mm;padding:2mm 3mm;font-size:6.6pt}
.hist .row{display:grid;grid-template-columns:repeat(6,1fr);text-align:center}
.hist h4{margin:0 0 1.5mm;font-size:8pt;font-weight:500}
.tbl{width:100%;border-collapse:collapse;font-size:7.2pt;margin-top:7mm}
.tbl th{background:#F2F2F2;font-weight:500;color:#333;text-align:left;padding:2.2mm 1.5mm;font-size:6.8pt}
.tbl td{padding:1.8mm 1.5mm;vertical-align:top}
.tbl .r{text-align:right}
.tbl .tot td{font-weight:700;padding-top:2.5mm}
.tbl tr,.svc tr{page-break-inside:avoid}
thead{display:table-header-group}
.p3{page-break-before:always;padding:0 7mm}
.p3 h1{color:#2E9BE6;font-size:17pt;font-weight:600;line-height:1.2;margin:4mm 0 8mm}
.p3 .who{font-size:6.6pt;line-height:1.45}
.p3 .ino{font-size:8pt;font-weight:600;margin:3mm 0 6mm}
.svc{width:88%;margin:2mm auto 0;border-collapse:collapse;font-size:7.4pt}
.svc th{background:#2E9BE6;color:#fff;font-weight:500;padding:2.2mm;border:0.6pt solid #2E9BE6}
.svc td{border:0.6pt solid #888;padding:1.8mm 2.5mm}
.svc .grp td{background:#E3F1DD;font-weight:500;font-size:7.8pt}
.svc .st td{background:#E5E5E5;font-weight:700}
.svc .c{text-align:center}
.payopt{background:#4D4D4D;color:#fff;border:0.6pt solid #111;margin:3mm 0 0;padding:4mm 6mm 6mm;font-size:7.4pt;line-height:1.6;page-break-inside:avoid}
.payopt ul{margin:2mm 0 0;padding-left:7mm;list-style:'◆  '}
.corp{border:0.6pt solid #111;margin:9mm 0 0;padding:6mm;text-align:center;font-size:6.4pt;line-height:1.8;page-break-inside:avoid}
`;

function page1(m, qr) {
  const inv = m.inv;
  const rows = [
    ['One Time Charges', 0],
    ['Monthly Charges', m.monthly],
    ['Usage Charges', m.usage],
    ...(m.isMobile ? [['- Call Charges', 0, 1], ['- SMS', 0, 1], ['- Mobile Internet', 0, 1], ['- National Roaming', 0, 1], ['- International Roaming', 0, 1]] : [['- Data / Overage', m.usage, 1]]),
    ['Contract Charges', 0],
    ['Discounts', 0],
    ['Other Debit Charges', 0],
    ['Late payment charges', 0],
    ['Total Charge Without Tax', m.net],
    ['Tax', m.tax],
    ['Total charges for the Current Bill Period', m.gross, 0, 1],
  ];
  return `
<section class="p1">
  <div class="band"><img src="${LOGO}" alt="6D Technologies"></div>
  <div class="cust">
    <div><h1>${esc(m.name)}</h1><div class="addr">${m.attn ? esc(m.attn) + '<br>' : ''}${m.addressLines.map(esc).join('<br>')}</div></div>
    <div class="kv">
      <b>Account No</b><span>: <b>${esc(m.ba.id)}</b></span>
      <span>No. of Connections</span><span>: ${m.services.length}</span>
      <span>Security Deposit</span><span>: <b>USD 0.00</b></span>
      <span>Alternate Contact No</span><span>: -</span>
    </div>
    <div class="kv">
      <b>Bill Cycle Date</b><span>: <b>${ddmmyy(inv.issueDate)}</b></span>
      <span>Invoice Date</span><span>: ${dow(inv.issueDate)}</span>
      <span>Bill Period</span><span>: ${ddmmyy(m.from)} to ${ddmmyy(m.to)}</span>
      <span>Invoice No</span><span>: ${esc(inv.id)}</span>
      <span>Description of Service</span><span>: Telecommunications</span>
    </div>
  </div>
  <div class="sumrow">
    <div class="sum">
      <div class="c">Previous Balance<div class="v">USD ${usd(m.prevBal)}</div></div><span class="op">-</span>
      <div class="c">Payments<div style="font-size:6.4pt;margin-top:.5mm">(Last 1 month)</div><div class="v">USD ${usd(m.paidLastMonth)}</div></div><span class="op">+</span>
      <div class="c">Adjustments<div class="v">USD 0.00</div></div><span class="op">+</span>
      <div class="c">Total Charges for the Current Bill Period<div class="v">USD ${usd(m.gross)}</div></div>
    </div>
    <div class="eq">=</div>
    <div class="pay">
      <div class="c">Total Payable Amount<div class="big${usd(m.totalPayable).length > 8 ? ' long' : ''}">USD ${usd(m.totalPayable)}</div><div class="tiny">Payable on or before ${long(inv.dueDate)}</div></div>
      <div class="c">Payable after<br><b style="color:#111">${long(inv.dueDate)}</b><div class="big${usd(m.totalPayable).length > 8 ? ' long' : ''}" style="margin-top:2mm">USD ${usd(m.totalPayable)}</div><div class="tiny">(incl USD 0 late payment charges)</div></div>
    </div>
  </div>
  <div class="note"><img class="i" src="${ICON.info}" alt=""><span>Please pay before due date to avoid any late payment fee. Pay previous balance, if any, immediately to avoid disconnection. Previous Balance refers to outstanding amount as per the last bill. Adjustments refers to any credits passed in your account due to reversal / waiver of any charges</span></div>
  <div class="lower">
    <table class="cs">
      <tr><th style="background:none">Charge Summary</th><th style="background:none">Amount (USD)</th></tr>
      ${rows.map(([l, v, sub, tot]) => `<tr class="${sub ? 'sub' : ''} ${tot ? 'tot' : ''}"><td>${esc(l)}</td><td>${usd(v)}</td></tr>`).join('')}
    </table>
    <div>
      <div class="ways"><h3>Many ways to pay your Bill</h3>
        <div class="icons"><span><img class="ico" src="${ICON.online}" alt="">Online<br>(My6d.in/6d-app)</span><span><img class="ico" src="${ICON.store}" alt="">6d Stores</span><span><img class="ico" src="${ICON.upi}" alt="">UPI</span></div>
      </div>
      <div class="pmt"><div>Cheque / DD should be payable to<br>6d Pvt Ltd. - ${m.acct}</div><div>For making payment using UPI, your<br>VPA ID VFIL${m.acct}@HSBC</div></div>
      <div class="qr">GST QR Code<br>Invoice Ref No: ${esc(inv.id)}<img src="${qr}" alt="Payment QR"></div>
      <div class="markbox"><img src="${MARK}" alt=""></div>
    </div>
  </div>
  <div class="foot">Keep your family safe and secure while using the internet, especially children &amp; young adults. Get tips at www.My6d.in/parental-control</div>
</section>`;
}

function page2(m) {
  const inv = m.inv;
  const hist = Array.from({ length: 6 }, (_, k) => {
    const dt = d(inv.period + '-01');
    dt.setUTCMonth(dt.getUTCMonth() - 5 + k);
    const p = dt.toISOString().slice(0, 7);
    const h = m.history.find((x) => x.period === p);
    return { label: mon(p), v: h ? usd(h.amount) : '-' };
  });
  const plans = [...new Set(m.lines.filter((l) => !l.usage).map((l) => l.plan))];
  const svcLines = m.lines.filter((l) => !l.usage);
  const usageLines = m.lines.filter((l) => l.usage);
  return `
<section class="flow">
  <h1>Your Usage Details</h1>
  <h2>${esc(m.name)}</h2>
  <div class="meta"><div><b>Bill Period</b>${ddmmyy(m.from)} to ${ddmmyy(m.to)}</div><div><b>Account ID</b>${esc(m.ba.id)}</div><div><b>Dynamic Credit Limit</b>USD ${usd(m.ba.creditLimit)}</div></div>
  <div class="small"><b>Your Postpaid Plan</b>${plans.length <= 3 ? ': ' + plans.map(esc).join(', ') : `: ${svcLines.length} connections on ${plans.length} plans`}<br>Above tariff details do not include any VAS tariffs, Roaming Charges, SMS/Call to special numbers, special promo packs or special promo features like Family &amp; Friends, CUG, etc</div>
  <div class="dep"><div>Your Security Deposit with<div class="v">:USD 0.00</div></div><div>Security deposit will be refunded within 60 days of closure of the account, beyond which, we will pay you an interest of <b>10% per anum</b> on the deposit.</div></div>
  <div class="hist">
    <div><h4>Last 6 Months Bill History</h4><div class="box"><div class="row">${hist.map((h) => `<span>${h.label}</span>`).join('')}</div><div class="row" style="margin-top:2mm">${hist.map((h) => `<span>${h.v}</span>`).join('')}</div></div></div>
    <div><h4>Last 3 Payments</h4><div class="box">${m.lastPayments.length ? m.lastPayments.map((p) => `<div style="display:flex;justify-content:space-between"><span>${ddmmyy(p.date)}</span><span>USD ${usd(p.amount)}</span></div>`).join('') : '-'}</div></div>
  </div>
  <div class="small" style="margin-top:3mm"><b>Note</b>: Payment details under Last 3 Payments section doesn't include any payments towards the deposit</div>
  <table class="tbl">
    <thead><tr><th>Monthly Charges</th><th>Service No.</th><th>Rental Period</th><th class="r">Units</th><th class="r">Charge/Units</th><th class="r">Charges (USD)</th><th class="r">Discounts (USD)</th><th class="r">Net Charges (USD)</th></tr></thead>
    ${svcLines.map((l) => `<tr><td>${esc(l.plan)}${l.where && l.where !== l.plan ? `<br><span style="color:#666;font-size:6.2pt">${esc(l.where)}</span>` : ''}</td><td>${esc(l.serviceNo)}</td><td>${ddmmyy(m.from)} to<br>${ddmmyy(m.to)}</td><td class="r">1</td><td class="r">${l.net.toFixed(7)}</td><td class="r">${usd(l.net)}</td><td class="r">0.00</td><td class="r">${usd(l.net)}</td></tr>`).join('')}
    <tr class="tot"><td>Total</td><td></td><td></td><td class="r">${svcLines.length}</td><td></td><td class="r">${usd(m.monthly)}</td><td class="r">0.00</td><td class="r">${usd(m.monthly)}</td></tr>
  </table>
  <table class="tbl">
    <thead><tr><th style="width:38%">Tax</th><th>Date</th><th class="r">Charges (USD)</th></tr></thead>
    <tr><td><b>GST @ ${(TAX_RATE * 100).toFixed(1)} %</b></td><td><b>${ddmmyy(m.from)} to ${ddmmyy(m.to)}</b></td><td class="r"><b>${usd(m.tax)}</b></td></tr>
    <tr class="tot"><td>Total<br><span style="font-weight:400;font-size:5.6pt">No Tax is payable on reverse charge</span></td><td></td><td class="r">${usd(m.tax)}</td></tr>
  </table>
  <table class="tbl">
    <thead><tr><th>Itemized Usage</th><th>Date &amp; Time</th><th>Number / APN</th><th>Duration / Volume</th><th class="r">Charges (USD)</th></tr></thead>
    ${usageLines.length ? usageLines.map((l) => `<tr><td>Data / overage (aggregated)</td><td>${ddmmyy(m.from)} to ${ddmmyy(m.to)}</td><td>${esc(l.where)}</td><td>—</td><td class="r">${usd(l.net)}</td></tr>`).join('') : `<tr><td colspan="4">No chargeable usage in this bill period (unlimited plan)</td><td class="r">0.00</td></tr>`}
    <tr class="tot"><td>Total</td><td></td><td></td><td></td><td class="r">${usd(m.usage)}</td></tr>
  </table>
</section>`;
}

function page3(m) {
  const svcLines = m.lines.filter((l) => !l.usage);
  const perService = svcLines.length <= 3;
  const block = (title, rows, sub) => `
    <table class="svc"><thead><tr><th style="width:50%">Description</th><th>Service Charges (USD)</th></tr></thead>
      <tr class="grp"><td colspan="2">${title}</td></tr>
      ${rows}
      <tr class="st"><td>Sub Total</td><td class="c">${usd(sub)}</td></tr></table>`;
  const body = perService
    ? svcLines.map((l) => `<div style="margin:5mm 0 0 6mm;font-size:7.6pt;font-weight:600">SERVICE NUMBER&nbsp;&nbsp;&nbsp;<span style="font-weight:500">${esc(l.serviceNo)}</span></div>${block('BUNDLE SUBSCRIPTIONS', `<tr><td>${esc(l.plan)}</td><td class="c">${usd(l.net)}</td></tr>`, l.net)}`).join('')
    : `<div style="margin:5mm 0 0 6mm;font-size:7.6pt;font-weight:600">SERVICE NUMBERS&nbsp;&nbsp;&nbsp;<span style="font-weight:500">${svcLines.length} connections</span></div>
       <table class="svc"><thead><tr><th>Service Number</th><th>Unit / Site</th><th style="width:40%">Description</th><th>Service Charges (USD)</th></tr></thead>
       <tr class="grp"><td colspan="4">BUNDLE SUBSCRIPTIONS</td></tr>
       ${svcLines.map((l) => `<tr><td>${esc(l.serviceNo)}</td><td>${esc(l.where)}</td><td>${esc(l.plan)}</td><td class="c">${usd(l.net)}</td></tr>`).join('')}
       <tr class="st"><td colspan="3">Sub Total</td><td class="c">${usd(m.monthly)}</td></tr></table>`;
  return `
<section class="p3">
  <h1>Enjoy the convenience of<br>monthly billing</h1>
  <div class="who">${esc(m.name.replace(/^Ms /, ''))}<br>${m.addressLines.map(esc).join('<br>')}</div>
  <div class="ino">INVOICE NO.&nbsp; ${esc(m.inv.id)}</div>
  <div style="font-size:7.6pt;font-weight:600;margin-left:1mm">Service Details</div>
  ${body}
  <p style="text-align:center;font-size:6.6pt;margin-top:40mm">Use Your Phone number or Account Number as a Payment Reference</p>
  <div class="payopt">Payment options :<ul><li>Direct Debit</li><li>Credit Card</li><li>Mobile App</li></ul></div>
  <div class="corp">26, Bannerghatta Main Road,J.P. Nagar Phase 3,<br>J.P. Nagar Phase 3, | http://www.6dtechnologies.com |<br>Phone: +91 80 4048 5959</div>
</section>`;
}

/* ---------- render ---------- */
const outDir = join(ROOT, 'public/bills');
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage();
const done = [];
for (const { inv, user } of targets) {
  if (only.length && !only.includes(inv.id)) continue;
  const m = model(inv, user);
  const qr = await QRCode.toDataURL(`upi://pay?pa=VFIL${m.acct}@HSBC&pn=6D%20Technologies&am=${usd(m.totalPayable)}&cu=USD&tn=${inv.id}`, { margin: 0, width: 360 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${page1(m, qr)}${page2(m)}${page3(m)}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: join(outDir, `${inv.id}.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true });
  done.push(inv.id);
  console.log('generated', inv.id, `(${user.name})`);
}
await browser.close();

if (!only.length) {
  writeFileSync(
    join(ROOT, 'src/data/billPdfs.ts'),
    `// Generated by scripts/bills/generate-bills.mjs — invoices that have a PDF in public/bills.\nexport const BILL_PDFS = new Set<string>(${JSON.stringify(done.sort(), null, 2)});\n`,
  );
}
