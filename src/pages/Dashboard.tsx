import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Building2, ClipboardCheck, CreditCard, Headphones, Network, Receipt, Settings as SettingsIcon, Users, Wifi } from 'lucide-react';
import { can, currentUser, getProfile, listAccounts, listApprovals, listBillingAccounts, listInvoices, listProperties, listRequests, listServices, toReporting } from '../api/api';
import { useApi } from '../lib/hooks';
import { date, money, pct } from '../lib/format';
import { Card, Kpi, LinkButton, Loading, Stat, StatusBadge } from '../components/ui';
import { MyHome } from './mdu/MyHome';
import { BigAmount, HeroCarousel, QuickLinks, StatusTile, Welcome, type QuickLink, type Slide } from '../components/template';

export const CHART = { royal: '#1F5FC4', orange: '#FF8A00', teal: '#00B4D8', navy: '#1B2140', green: '#10B981', purple: '#8B5CF6', grey: '#94A3B8', red: '#DC2626', amber: '#F59E0B' };
const STATUS_COLOURS: Record<string, string> = { Active: CHART.green, Suspended: CHART.purple, 'Pending Installation': CHART.amber, 'Pending Change': CHART.teal, Terminated: CHART.grey };

async function loadDashboard() {
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [accounts, services, properties, requests, billing, invoices, approvals, profile] = await Promise.all([
    can('account.read') ? safe(listAccounts(), []) : Promise.resolve([]),
    can('service.read') ? safe(listServices(), []) : Promise.resolve([]),
    can('property.read') ? safe(listProperties(), []) : Promise.resolve([]),
    listRequests(),
    can('billing.read') ? safe(listBillingAccounts(), []) : Promise.resolve([]),
    can('billing.read') ? safe(listInvoices(), []) : Promise.resolve([]),
    listApprovals(),
    getProfile(),
  ]);
  return { accounts, services, properties, requests, billing, invoices, approvals, profile };
}

export function Dashboard() {
  const user = currentUser();
  const q = useApi(loadDashboard, [user.id]);
  const nav = useNavigate();
  if (user.roleId === 'RESIDENT') return <MyHome />;
  if (!q.data) return <Loading />;
  const { accounts, services, properties, requests, billing, invoices, approvals, profile } = q.data;

  const outstanding = billing.reduce((a, b) => a + toReporting(b.balance, b.currency), 0);
  const overdue = billing.reduce((a, b) => a + toReporting(b.overdue, b.currency), 0);
  const openReq = requests.filter((r) => !['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(r.status));
  const pendingApprovals = approvals.filter((a) => a.canDecide);
  const units = properties.reduce((a, p) => a + p.totalUnits, 0);
  const connected = properties.reduce((a, p) => a + p.connected, 0);

  const byStatus = Object.entries(services.reduce<Record<string, number>>((m, s) => ((m[s.status] = (m[s.status] ?? 0) + 1), m), {})).map(([name, value]) => ({ name, value }));
  const byType = Object.entries(accounts.reduce<Record<string, number>>((m, a) => ((m[a.type] = (m[a.type] ?? 0) + 1), m), {})).map(([name, value]) => ({ name, value }));
  const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const trend = months.map((m) => ({ month: new Date(m + '-01').toLocaleString('en', { month: 'short' }), amount: Math.round(invoices.filter((i) => i.period === m).reduce((a, i) => a + toReporting(i.amount, i.currency), 0)) }));
  const penetration = properties.map((p) => ({ name: p.name.split(' ')[0] + ' ' + (p.name.split(' ')[1] ?? ''), Connected: p.connected, Pending: p.pending, 'Ready, not connected': p.ready, 'Not ready': p.notReady }));
  const reqByCat = Object.entries(openReq.reduce<Record<string, number>>((m, r) => ((m[r.category] = (m[r.category] ?? 0) + 1), m), {})).map(([name, value]) => ({ name, value }));
  const org = profile.organisation;
  const nextDue = invoices.filter((i) => i.status !== 'Paid').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const isMdu = properties.length > 0 && !accounts.some((a) => a.tenantId === user.tenantId && a.type !== 'Root');
  const headline = isMdu
    ? { status: `${pct(connected, units)}% connected`, tone: 'green' as const, Icon: Building2, big: `${properties.length} MDUs`, caption: 'Units under management', detail: `${units} units · ${connected} connected`, link: 'Bulk service activation', linkTo: '/services/bulk', to: '/mdu' }
    : { status: 'Active', tone: 'green' as const, Icon: Wifi, big: `${services.filter((s) => s.status === 'Active').length} Services`, caption: 'Business accounts', detail: `${accounts.length} accounts · ${services.filter((s) => s.status === 'Pending Installation').length} pending installs`, link: 'View account hierarchy', linkTo: '/accounts/hierarchy', to: '/services' };
  const slides: Slide[] = isMdu
    ? [
        { title: 'FiberHome 1 Gbps – MDU launch offer', body: 'Zero installation fee on bulk activations of 10+ ready units until 31 Dec 2026.', cta: 'Order Now', to: '/services/bulk', image: './hero/hero-01.webp' },
        { title: 'Common-area Wi-Fi for every clubhouse', body: 'Managed Wi-Fi 6 for lobbies and amenities, billed to the property account.', cta: 'Check availability', to: '/services/availability', image: './hero/hero-03.webp' },
        { title: 'Onboard towers in minutes', body: 'Upload your unit register as CSV — we validate every row before import.', cta: 'Import units', to: '/mdu/import', image: './hero/hero-05.webp' },
      ]
    : [
        { title: 'More bandwidth, more savings with 6D Enterprise Fibre', body: '1 Gbps symmetric, managed CPE and 99.95% availability SLA on a 36-month term.', cta: 'Order Now', to: '/services/new', image: './hero/hero-01.webp' },
        { title: 'SD-WAN for every branch at 20% off', body: 'Connect subsidiaries and branches on one policy-driven overlay.', cta: 'Check availability', to: '/services/availability', image: './hero/hero-03.webp' },
        { title: 'Consolidated billing across your group', body: 'Roll every subsidiary up into one invoice — and still allocate cost by department.', cta: 'View billing hierarchy', to: '/billing/hierarchy', image: './hero/hero-07.webp' },
      ];
  const quickLinks: QuickLink[] = [
    isMdu ? { label: 'Units', to: '/mdu/units', icon: <Building2 className="h-6 w-6" />, colour: 'bg-[#B5672C]' } : { label: 'Switch Account', to: '/accounts/hierarchy', icon: <Users className="h-6 w-6" />, colour: 'bg-[#B5672C]' },
    { label: 'Bills', to: '/billing', icon: <Receipt className="h-6 w-6" />, colour: 'bg-[#FF6A13]' },
    { label: 'Settings', to: '/settings', icon: <SettingsIcon className="h-6 w-6" />, colour: 'bg-[#F27D86]' },
    { label: 'Support', to: '/requests', icon: <Headphones className="h-6 w-6" />, colour: 'bg-[#1287D8]' },
  ];

  return (
    <div>
      <Welcome name={user.name} id={org ? `${org.name} · ${org.id}` : `${profile.tenant.name} · ${user.id}`} onEdit={() => nav('/settings')} />
      <HeroCarousel slides={slides} />

      <div className="mb-8 grid gap-6 xl:grid-cols-3">
        <section className="rounded-card border border-line-100 bg-brand-soft p-5 xl:col-span-2">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <h2 className="text-[22px] font-medium text-navy">My Services</h2>
            <h2 className="hidden text-[22px] font-medium text-navy sm:block">Billing</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatusTile status={headline.status} tone={headline.tone} onClick={() => nav(headline.to)}>
              <headline.Icon className="h-8 w-8 text-ink-400" />
              <p className="mt-3 text-[34px] font-semibold leading-tight text-navy">{headline.big}</p>
              <p className="mt-3 text-sm font-medium text-ink-400">{headline.caption}</p>
              <p className="text-lg text-navy">{headline.detail}</p>
              <button onClick={(e) => (e.stopPropagation(), nav(headline.linkTo))} className="mt-3 text-[17px] font-medium text-royal hover:underline">
                {headline.link}
              </button>
            </StatusTile>
            <StatusTile status={overdue ? 'OverDue' : outstanding ? 'Due' : 'Paid up'} tone={overdue ? 'red' : outstanding ? 'amber' : 'green'}>
              <p className="mt-4 text-lg text-ink-400">Amount Due</p>
              <BigAmount amount={outstanding} />
              <p className="mt-4 text-lg font-semibold text-navy">{nextDue ? `Due By ${date(nextDue.dueDate)}` : 'Nothing due'}</p>
              <div className="mt-4 flex justify-end">
                {can('billing.pay') && outstanding > 0 ? (
                  <LinkButton to="/billing/invoices?status=Overdue" variant="primary">
                    Pay now
                  </LinkButton>
                ) : (
                  <LinkButton to="/billing" variant="secondary">
                    View bills
                  </LinkButton>
                )}
              </div>
            </StatusTile>
          </div>
        </section>
        <section className="rounded-card border border-line-100 bg-brand-soft p-5">
          <h2 className="mb-4 text-[22px] font-medium text-navy">Quick Links</h2>
          <QuickLinks links={quickLinks} />
        </section>
      </div>

      <h2 className="mb-4 text-[22px] font-medium text-navy">At a glance</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {can('account.read') && accounts.length > 0 && <Kpi label="Total accounts" value={accounts.length} hint={`${accounts.filter((a) => a.type !== 'Root').length} child accounts`} icon={<Network className="h-4 w-4" />} to="/accounts" />}
        <Kpi label="Total services" value={services.length} tone="orange" hint={`${services.filter((s) => s.status === 'Active').length} active`} icon={<Wifi className="h-4 w-4" />} to="/services" />
        {properties.length > 0 && <Kpi label="MDU properties" value={properties.length} hint={`${units} units`} icon={<Building2 className="h-4 w-4" />} to="/mdu" />}
        {properties.length > 0 && <Kpi label="Connected units" value={`${pct(connected, units)}%`} tone="green" hint={`${connected} of ${units}`} to="/reports" />}
        <Kpi label="Outstanding" value={money(outstanding, 'INR', true)} tone={overdue ? 'red' : 'default'} hint={overdue ? `${money(overdue, 'INR', true)} overdue` : 'Nothing overdue'} icon={<CreditCard className="h-4 w-4" />} to="/billing" />
        <Kpi label="Open requests" value={openReq.length} hint={`${openReq.filter((r) => r.kind === 'Incident').length} incidents`} icon={<AlertTriangle className="h-4 w-4" />} to="/requests" />
        <Kpi label="Awaiting my approval" value={pendingApprovals.length} tone={pendingApprovals.length ? 'orange' : 'default'} icon={<ClipboardCheck className="h-4 w-4" />} to="/approvals" />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card title="Services by status">
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {byStatus.map((s) => (
                    <Cell key={s.name} fill={STATUS_COLOURS[s.name] ?? CHART.grey} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Monthly billing trend (INR)">
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ left: 10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={11} tickFormatter={(v) => money(v, 'INR', true)} width={70} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Line type="monotone" dataKey="amount" stroke={CHART.royal} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        {properties.length > 0 ? (
          <Card title="MDU connectivity penetration">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={penetration} margin={{ top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Connected" stackId="a" fill={CHART.green} />
                  <Bar dataKey="Pending" stackId="a" fill={CHART.amber} />
                  <Bar dataKey="Ready, not connected" stackId="a" fill={CHART.royal} />
                  <Bar dataKey="Not ready" stackId="a" fill={CHART.red} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        ) : (
          <Card title="Business accounts by type">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={byType} margin={{ top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" name="Accounts" fill={CHART.royal} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Profile details" className="xl:col-span-2" actions={<LinkButton to="/settings" size="sm" variant="ghost">Manage</LinkButton>}>
          {org ? (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="Company name">{org.name}</Stat>
              <Stat label="Company registration ID">{org.registrationNo}</Stat>
              <Stat label="Profile ID">{org.id}</Stat>
              <Stat label="Sector">{org.sector ?? org.industry}</Stat>
              <Stat label="Creation date">{date(org.createdAt)}</Stat>
              <Stat label="Primary contact">{profile.contacts.find((c) => c.isPrimary)?.name}</Stat>
              <Stat label="Mobile number">{profile.contacts.find((c) => c.isPrimary)?.phone}</Stat>
              <Stat label="Email address">{profile.contacts.find((c) => c.isPrimary)?.email}</Stat>
              <Stat label="Signed in as">
                {user.name} · {profile.role.name}
              </Stat>
            </dl>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat label="Signed in as">{user.name}</Stat>
              <Stat label="Role">{profile.role.name}</Stat>
              <Stat label="Organisation">{profile.tenant.name}</Stat>
            </dl>
          )}
        </Card>
        <Card title="Open requests by category" actions={<LinkButton to="/requests" size="sm" variant="ghost">View all</LinkButton>}>
          {reqByCat.length ? (
            <ul className="space-y-2">
              {reqByCat.map((r) => (
                <li key={r.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{r.name}</span>
                  <span className="rounded-full bg-royal-50 px-2 font-bold text-royal">{r.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No open requests.</p>
          )}
          {pendingApprovals.length > 0 && (
            <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs font-bold text-orange-800">Awaiting your approval</p>
              {pendingApprovals.slice(0, 3).map((a) => (
                <button key={a.id} onClick={() => nav('/approvals')} className="mt-1 block w-full truncate text-left text-xs text-orange-900 hover:underline">
                  <StatusBadge status="Pending" className="mr-1" /> {a.summary}
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
