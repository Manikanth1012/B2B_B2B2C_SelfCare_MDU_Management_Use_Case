import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { can, listAccounts, listInvoices, listProperties, listRequests, listServices, toReporting } from '../api/api';
import { useApi } from '../lib/hooks';
import { downloadText, money, pct, toCsv } from '../lib/format';
import { Button, Card, ErrorState, Kpi, Loading, PageHeader, Select, Tabs } from '../components/ui';
import { CHART } from './Dashboard';

async function load() {
  const [accounts, services, properties, invoices, requests] = await Promise.all([
    can('account.read') ? listAccounts().catch(() => []) : Promise.resolve([]),
    listServices().catch(() => []),
    can('property.read') ? listProperties().catch(() => []) : Promise.resolve([]),
    listInvoices().catch(() => []),
    listRequests(),
  ]);
  return { accounts, services, properties, invoices, requests };
}

const PIE = [CHART.royal, CHART.orange, CHART.green, CHART.purple, CHART.teal, CHART.red, CHART.grey];
const count = <T,>(xs: T[], k: (x: T) => string) => Object.entries(xs.reduce<Record<string, number>>((m, x) => ((m[k(x)] = (m[k(x)] ?? 0) + 1), m), {})).map(([name, value]) => ({ name, value }));

export function Reports() {
  const q = useApi(load);
  const [tabSel, setTab] = useState('accounts');
  const [cat, setCat] = useState('All');
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const { accounts, services, properties, invoices, requests } = q.data;
  const tabs = [
    ...(accounts.length ? [{ id: 'accounts', label: 'Account Analytics' }] : []),
    ...(properties.length ? [{ id: 'mdu', label: 'MDU Occupancy & Penetration' }] : []),
    { id: 'revenue', label: 'Revenue & Usage' },
    { id: 'ops', label: 'Requests & Installations' },
  ];
  const tab = tabs.some((t) => t.id === tabSel) ? tabSel : tabs[0].id;
  const svc = services.filter((s) => cat === 'All' || s.category === cat);
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
      {tab === 'accounts' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card title="Business accounts by type">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={count(accounts, (a) => a.type)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" name="Accounts" fill={CHART.royal} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Services by status" actions={<Select label="Service type" value={cat} onChange={setCat} options={['All', 'FTTH Broadband', 'Leased Line', 'SD-WAN', 'Voice', 'IoT', 'Managed Services']} className="w-48" />}>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={count(svc, (s) => s.status)} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                    {count(svc, (s) => s.status).map((_, i) => (
                      <Cell key={i} fill={PIE[i % PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Active services per account" className="xl:col-span-2">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={accounts.filter((a) => a.activeServices).map((a) => ({ name: a.name, services: a.activeServices }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="services" fill={CHART.orange} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
      {tab === 'mdu' && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Units" value={properties.reduce((a, p) => a + p.totalUnits, 0)} />
            <Kpi label="Occupancy" value={`${pct(properties.reduce((a, p) => a + p.occupied, 0), properties.reduce((a, p) => a + p.totalUnits, 0))}%`} tone="orange" />
            <Kpi label="Penetration (of all units)" value={`${pct(properties.reduce((a, p) => a + p.connected, 0), properties.reduce((a, p) => a + p.totalUnits, 0))}%`} tone="green" />
            <Kpi label="Penetration (of occupied)" value={`${pct(properties.reduce((a, p) => a + p.connected, 0), properties.reduce((a, p) => a + p.occupied, 0))}%`} tone="green" />
          </div>
          <Card title="Connectivity vs occupancy by property">
            <div className="h-80">
              <ResponsiveContainer>
                <BarChart data={properties.map((p) => ({ name: p.name, Occupied: p.occupied, Connected: p.connected, Pending: p.pending, 'Network not ready': p.notReady }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Occupied" fill={CHART.navy} />
                  <Bar dataKey="Connected" fill={CHART.green} />
                  <Bar dataKey="Pending" fill={CHART.amber} />
                  <Bar dataKey="Network not ready" fill={CHART.red} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
          <Card title="Open requests by category">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={count(requests.filter((r) => !['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(r.status)), (r) => r.category)} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="name" width={170} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" name="Open" fill={CHART.red} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Active vs pending installations">
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={[{ name: 'Active', value: services.filter((s) => s.status === 'Active').length }, { name: 'Pending installation', value: services.filter((s) => s.status === 'Pending Installation').length }]} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                    <Cell fill={CHART.green} />
                    <Cell fill={CHART.amber} />
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
