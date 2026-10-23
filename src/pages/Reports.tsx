import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { can, listAccounts, listInvoices, listProperties, listRequests, listServices, listUnits, toReporting } from '../api/api';
import { useApi } from '../lib/hooks';
import { downloadText, money, pct, toCsv } from '../lib/format';
import { Button, Card, ErrorState, Kpi, Loading, PageHeader, Tabs } from '../components/ui';
import { CHART } from './Dashboard';

async function load() {
  const [accounts, services, properties, invoices, requests, units] = await Promise.all([
    can('account.read') ? listAccounts().catch(() => []) : Promise.resolve([]),
    listServices().catch(() => []),
    can('property.read') ? listProperties().catch(() => []) : Promise.resolve([]),
    listInvoices().catch(() => []),
    listRequests(),
    can('property.read') ? listUnits().catch(() => []) : Promise.resolve([]),
  ]);
  return { accounts, services, properties, invoices, requests, units };
}

const PIE = [CHART.royal, CHART.orange, CHART.green, CHART.purple, CHART.teal, CHART.red, CHART.grey];

export function Reports() {
  const q = useApi(load);
  const [tabSel, setTab] = useState('accounts');
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const { accounts, services, properties, invoices, requests, units } = q.data;
  const tabs = [
    ...(accounts.length ? [{ id: 'accounts', label: 'Account Analytics' }] : []),
    ...(properties.length ? [{ id: 'mdu', label: 'MDU Occupancy & Penetration' }] : []),
    { id: 'revenue', label: 'Revenue & Usage' },
    { id: 'ops', label: 'Requests & Installations' },
  ];
  const tab = tabs.some((t) => t.id === tabSel) ? tabSel : tabs[0].id;
  const bizSvc = services.filter((s) => s.businessAccountId && s.status !== 'Terminated');
  const mixCats = [...new Set(bizSvc.map((s) => s.category))];
  const mix = {
    cats: mixCats,
    rows: accounts
      .filter((a) => bizSvc.some((s) => s.businessAccountId === a.id))
      .map((a) => ({ name: a.name, ...Object.fromEntries(mixCats.map((c) => [c, bizSvc.filter((s) => s.businessAccountId === a.id && s.category === c).length])) })),
  };
  const mrcByAccount = accounts
    .map((a) => ({ name: a.name, mrc: Math.round(bizSvc.filter((s) => s.businessAccountId === a.id && s.status === 'Active').reduce((x, s) => x + toReporting(s.mrc, s.currency), 0)) }))
    .filter((r) => r.mrc > 0)
    .sort((x, y) => y.mrc - x.mrc);
  const quarter = (d: string) => `${d.slice(0, 4)} Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
  const quarters = ['2026 Q4', '2027 Q1', '2027 Q2', '2027 Q3', '2027 Q4', '2028 Q1'];
  const renewals = quarters.map((qq) => {
    const due = bizSvc.filter((s) => s.contractEnd && quarter(s.contractEnd) === qq);
    return { q: qq, count: due.length, mrc: Math.round(due.reduce((x, s) => x + toReporting(s.mrc, s.currency), 0)) };
  });
  const towers = Object.values(
    units.reduce<Record<string, { name: string; occ: number; conn: number; ready: number; total: number }>>((m, u) => {
      const k = `${u.propertyName.split(' ')[0]} ${u.building.replace('Tower ', 'T-')}`;
      m[k] ??= { name: k, occ: 0, conn: 0, ready: 0, total: 0 };
      m[k].total++;
      if (u.occupancy === 'Occupied') m[k].occ++;
      if (u.connectivity === 'Connected') m[k].conn++;
      if (u.networkReadiness === 'Ready') m[k].ready++;
      return m;
    }, {}),
  ).map((t) => ({ name: t.name, penetration: pct(t.conn, t.occ), readiness: pct(t.ready, t.total) }));
  const closedSt = ['Completed', 'Rejected', 'Cancelled', 'Failed'];
  const sla = [...new Set(requests.map((r) => r.category))].map((c) => {
    const rs = requests.filter((r) => r.category === c);
    return { name: c, Closed: rs.filter((r) => closedSt.includes(r.status)).length, 'Open within SLA': rs.filter((r) => !closedSt.includes(r.status) && r.slaDue >= '2026-10-23').length, 'Open, SLA breached': rs.filter((r) => !closedSt.includes(r.status) && r.slaDue < '2026-10-23').length };
  });
  const backlog = Object.entries(
    services
      .filter((s) => s.status === 'Pending Installation')
      .reduce<Record<string, number>>((m, s) => {
        const k = s.unitId ? s.location.split(',')[0] : s.customerName;
        m[k] = (m[k] ?? 0) + 1;
        return m;
      }, {}),
  ).map(([name, pending]) => ({ name, pending }));
  const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const revenue = months.map((m) => {
    const row: Record<string, string | number> = { month: new Date(m + '-01').toLocaleString('en', { month: 'short' }) };
    invoices.filter((i) => i.period === m).forEach((i) => i.lines.forEach((l) => {
      const c = services.find((s) => s.id === l.serviceId)?.category ?? 'Usage & other';
      row[c] = ((row[c] as number) ?? 0) + Math.round(toReporting(l.amount, i.currency));
    }));
    return row;
  });
  const revCats = [...new Set(revenue.flatMap((r) => Object.keys(r).filter((k) => k !== 'month')))];
  const exportCsv = () => {
    if (tab === 'mdu') downloadText('mdu-penetration.csv', toCsv([['Property', 'Units', 'Occupied', 'Connected', 'Penetration %', 'Pending', 'Not ready'], ...properties.map((p) => [p.name, p.totalUnits, p.occupied, p.connected, pct(p.connected, p.totalUnits), p.pending, p.notReady])]));
    else if (tab === 'revenue') downloadText('revenue.csv', toCsv([['Month', ...revCats], ...revenue.map((r) => [r.month as string, ...revCats.map((c) => (r[c] as number) ?? 0)])]));
    else downloadText('accounts.csv', toCsv([['Account', 'Type', 'Status', 'Parent', 'Active services'], ...accounts.map((a) => [a.name, a.type, a.status, a.parentName, a.activeServices])]));
  };
  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="All figures are computed only from data within your authorised scope." crumbs={[{ label: 'Admin' }, { label: 'Reports' }]} actions={<Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>} />
      <Tabs active={tab} onChange={setTab} tabs={tabs} />
      {/* Reports go deeper than the Dashboard: no chart here repeats a Dashboard chart. */}
      {tab === 'accounts' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Service mix by account">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={mix.rows} margin={{ bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" />
                  <XAxis dataKey="name" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {mix.cats.map((c, i) => (
                    <Bar key={c} dataKey={c} stackId="a" fill={PIE[i % PIE.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Monthly recurring revenue by account">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={mrcByAccount} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" />
                  <XAxis type="number" fontSize={11} tickFormatter={(v) => money(v, 'USD', true)} />
                  <YAxis type="category" dataKey="name" width={150} fontSize={11} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="mrc" name="Active MRC" fill={CHART.orange} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Contract renewals by quarter (business services)" className="xl:col-span-2">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={renewals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" />
                  <XAxis dataKey="q" fontSize={12} />
                  <YAxis yAxisId="l" allowDecimals={false} fontSize={11} />
                  <YAxis yAxisId="r" orientation="right" fontSize={11} tickFormatter={(v) => money(v, 'USD', true)} />
                  <Tooltip formatter={(v: number, n: string) => (n === 'MRC up for renewal' ? money(v) : v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="l" dataKey="count" name="Contracts ending" fill={CHART.royal} radius={[6, 6, 0, 0]} />
                  <Bar yAxisId="r" dataKey="mrc" name="MRC up for renewal" fill={CHART.teal} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
      {tab === 'mdu' && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Occupied, not connected" value={units.filter((u) => u.occupancy === 'Occupied' && u.connectivity !== 'Connected').length} hint="Upsell opportunities" />
            <Kpi label="Occupancy" value={`${pct(properties.reduce((a, p) => a + p.occupied, 0), properties.reduce((a, p) => a + p.totalUnits, 0))}%`} tone="orange" />
            <Kpi label="Penetration (of all units)" value={`${pct(properties.reduce((a, p) => a + p.connected, 0), properties.reduce((a, p) => a + p.totalUnits, 0))}%`} tone="green" />
            <Kpi label="Penetration (of occupied)" value={`${pct(properties.reduce((a, p) => a + p.connected, 0), properties.reduce((a, p) => a + p.occupied, 0))}%`} tone="green" />
          </div>
          <Card title="Penetration by building (connected ÷ occupied)">
            <div className="h-80">
              <ResponsiveContainer>
                <BarChart data={towers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="penetration" name="Connected of occupied" fill={CHART.green} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="readiness" name="Network-ready units" fill={CHART.royal} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-ink-400">Low penetration with high readiness = sales opportunity; low readiness = network build needed.</p>
          </Card>
        </>
      )}
      {tab === 'revenue' && (
        <Card title="Monthly billed revenue by product family (USD)">
          <div className="h-80">
            <ResponsiveContainer>
              <AreaChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={11} width={70} tickFormatter={(v) => money(v, 'USD', true)} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {revCats.map((c, i) => (
                  <Area key={c} type="monotone" dataKey={c} stackId="1" stroke={PIE[i % PIE.length]} fill={PIE[i % PIE.length]} fillOpacity={0.55} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-ink-400">Resident individual billing is excluded unless you are the paying party.</p>
        </Card>
      )}
      {tab === 'ops' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="SLA performance by request category">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={sla} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="name" width={170} fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Closed" stackId="a" fill={CHART.green} />
                  <Bar dataKey="Open within SLA" stackId="a" fill={CHART.royal} />
                  <Bar dataKey="Open, SLA breached" stackId="a" fill={CHART.red} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Installation backlog by site">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={backlog}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="pending" name="Pending installations" fill={CHART.amber} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
