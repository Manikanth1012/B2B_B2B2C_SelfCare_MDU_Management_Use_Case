import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { FileText, LifeBuoy, Package, Phone, Plus, Upload, Zap } from 'lucide-react';
import { can, getProperty, listProperties } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date, dateTime, money, pct } from '../../lib/format';
import { Card, DataTable, ErrorState, Kpi, LinkButton, Loading, PageHeader, ProgressBar, Select, Stat, StatusBadge, Tabs, Tag, useToast } from '../../components/ui';
import { BuildingsUnits } from './BuildingsUnits';
import { Occupancy } from './Occupancy';
import { CHART } from '../Dashboard';

export function PropertyDetail() {
  const { id = '' } = useParams();
  const q = useApi(() => getProperty(id), [id]);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const setTab = (t: string) => setParams({ tab: t }, { replace: true });
  const all = useApi(listProperties);
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const d = q.data;
  const p = d.property;
  const openReq = d.requests.filter((r) => !['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(r.status));

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {p.name} <StatusBadge status={p.status} />
          </span>
        }
        subtitle={
          <span>
            <span className="font-mono text-xs">{p.id}</span> · {p.address}, {p.city} · Manager: {p.managerName} · Readiness: <StatusBadge status={p.readiness} />
          </span>
        }
        crumbs={[{ label: 'MDU Portfolio', to: '/mdu' }, { label: p.name }]}
        actions={
          <>
            {(all.data?.length ?? 0) > 1 && (
              <Select label="Switch property" value={p.id} onChange={(v) => nav(`/mdu/${v}?tab=${tab}`)} options={all.data!.map((x) => ({ value: x.id, label: x.name }))} className="w-60" />
            )}
            {can('unit.manage') && (
              <LinkButton to={`/mdu/import?property=${p.id}`}>
                <Upload className="h-4 w-4" /> Import units
              </LinkButton>
            )}
            {can('service.bulk') && (
              <LinkButton to={`/services/bulk?property=${p.id}`} variant="primary">
                <Zap className="h-4 w-4" /> Bulk activation
              </LinkButton>
            )}
            {can('property.read') && (
              <LinkButton to={`/mdu/phone-numbers?property=${p.id}`} variant="secondary">
                <Phone className="h-4 w-4" /> Phone Numbers
              </LinkButton>
            )}
            {can('unit.manage') && (
              <LinkButton to={`/mdu/addons?property=${p.id}`} variant="secondary">
                <Package className="h-4 w-4" /> Add-ons
              </LinkButton>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total units" value={p.totalUnits} hint={`${p.buildings} buildings`} />
        <Kpi label="Occupied units" value={p.occupied} hint={`${pct(p.occupied, p.totalUnits)}% occupancy`} />
        <Kpi label="Connected units" value={p.connected} tone="green" hint={`${pct(p.connected, p.totalUnits)}% penetration`} />
        <Kpi label="Available (ready, no service)" value={p.ready} />
        <Kpi label="Pending installations" value={p.pending} tone="orange" />
        <Kpi label="Open tickets" value={p.openTickets} />
      </div>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'units', label: 'Buildings & Units', count: p.totalUnits },
          { id: 'residents', label: 'Residents / Occupants', count: p.occupied },
          { id: 'services', label: 'Connectivity & Services', count: d.services.length },
          { id: 'billing', label: 'Billing & Contracts' },
          { id: 'requests', label: 'Requests & Maintenance', count: openReq.length },
          { id: 'docs', label: 'Documents' },
          { id: 'history', label: 'Activity History' },
        ]}
      />
      {tab === 'overview' && <Overview d={d} />}
      {tab === 'units' && (
        <Card>
          <BuildingsUnits propertyId={p.id} buildings={d.buildings} />
        </Card>
      )}
      {tab === 'residents' && <Occupancy key={p.id} propertyId={p.id} embedded />}
      {tab === 'services' && <ServicesTab d={d} />}
      {tab === 'billing' && <BillingTab d={d} />}
      {tab === 'requests' && <RequestsTab d={d} />}
      {tab === 'docs' && <Documents propertyName={p.name} />}
      {tab === 'history' && (
        <Card title="Activity history">
          <ol className="relative ml-2 border-l border-line-200">
            {d.history.map((e) => (
              <li key={e.id} className="mb-4 ml-4">
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-royal" />
                <p className="text-sm font-semibold text-navy">{e.action}</p>
                <p className="text-xs text-slate-600">{e.detail}</p>
                <p className="text-[11px] text-slate-500">
                  {e.actor} · {dateTime(e.at)}
                </p>
              </li>
            ))}
            {!d.history.length && <p className="text-sm text-slate-500">No recorded activity.</p>}
          </ol>
        </Card>
      )}
    </div>
  );
}

function Overview({ d }: { d: Awaited<ReturnType<typeof getProperty>> }) {
  const p = d.property;
  const conn = [
    { name: 'Connected', value: p.connected, c: CHART.green },
    { name: 'Pending installation', value: p.pending, c: CHART.amber },
    { name: 'Ready for service', value: p.ready, c: CHART.royal },
    { name: 'Network not ready', value: p.notReady, c: CHART.red },
    { name: 'Suspended', value: p.suspended, c: CHART.purple },
  ];
  const occ = [
    { name: 'Occupied', value: p.occupied, c: CHART.navy },
    { name: 'Vacant', value: p.vacant, c: CHART.grey },
    { name: 'Unknown', value: p.totalUnits - p.occupied - p.vacant, c: '#CBD5E1' },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Property information" className="lg:col-span-2">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Property type">{p.type}</Stat>
          <Stat label="Management organisation">{p.managementOrg}</Stat>
          <Stat label="Property manager">{p.managerName}</Stat>
          <Stat label="Address">
            {p.address}, {p.city}
          </Stat>
          <Stat label="Geolocation">{p.geo ? `${p.geo.lat.toFixed(4)}, ${p.geo.lng.toFixed(4)}` : 'Not provided'}</Stat>
          <Stat label="Contact">
            {p.contactPhone} · {p.contactEmail}
          </Stat>
          <Stat label="Access technology">
            <Tag>{p.technology}</Tag>
          </Stat>
          <Stat label="Network readiness">
            <StatusBadge status={p.readiness} />
          </Stat>
          <Stat label="Capacity (access ports)">{p.capacityPorts}</Stat>
          <Stat label="Distribution equipment">{p.equipment}</Stat>
          <Stat label="Planned / actual activation">{date(p.plannedActivation)}</Stat>
          <Stat label="Billing arrangement">{p.billingModel}</Stat>
        </dl>
      </Card>
      <Card title="Capacity">
        <p className="mb-1 text-xs text-slate-600">Access ports in use</p>
        <ProgressBar value={p.connected + p.pending + p.suspended} max={p.capacityPorts} tone="teal" />
        <p className="mt-1 text-sm font-semibold text-navy">
          {p.connected + p.pending + p.suspended} / {p.capacityPorts}
        </p>
        <p className="mt-4 mb-1 text-xs text-slate-600">Connectivity penetration</p>
        <ProgressBar value={p.connected} max={p.totalUnits} tone="green" />
        <p className="mt-1 text-sm font-semibold text-navy">{pct(p.connected, p.totalUnits)}%</p>
      </Card>
      {[
        { t: 'Connectivity breakdown', data: conn },
        { t: 'Occupancy breakdown (independent of connectivity)', data: occ },
      ].map((c) => (
        <Card key={c.t} title={c.t} className={c.t.startsWith('Occ') ? 'lg:col-span-1' : 'lg:col-span-2'}>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={c.data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={1}>
                    {c.data.map((x) => (
                      <Cell key={x.name} fill={x.c} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full space-y-1.5 text-sm">
              {c.data.map((x) => (
                <li key={x.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-sm" style={{ background: x.c }} />
                  <span className="flex-1 text-slate-700">{x.name}</span>
                  <span className="font-semibold text-navy">{x.value}</span>
                  <span className="w-10 text-right text-xs text-slate-500">{pct(x.value, p.totalUnits)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ))}
    </div>
  );
}

function ServicesTab({ d }: { d: Awaited<ReturnType<typeof getProperty>> }) {
  const nav = useNavigate();
  const shared = d.services.filter((s) => !s.unitId);
  const unitSrv = d.services.filter((s) => s.unitId && s.status !== 'Terminated');
  return (
    <div className="grid gap-4">
      <Card title="Shared property services" actions={can('service.order') && <LinkButton size="sm" to="/services/availability">Check availability</LinkButton>}>
        <DataTable
          rows={shared}
          rowKey={(s) => s.id}
          onRowClick={(s) => nav(`/services/${s.id}`)}
          mobileTitle={(s) => s.offeringName}
          columns={[
            { key: 'p', header: 'Product', render: (s) => <span className="font-semibold">{s.offeringName}</span>, mobileHidden: true },
            { key: 'l', header: 'Location', render: (s) => s.location },
            { key: 's', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
            { key: 'm', header: 'MRC', render: (s) => money(s.mrc) },
            { key: 'b', header: 'Billed to', render: (s) => <span className="font-mono text-xs">{s.billingAccountId}</span> },
          ]}
        />
      </Card>
      <Card title={`Unit subscriptions (${unitSrv.length})`}>
        <DataTable
          rows={unitSrv}
          rowKey={(s) => s.id}
          onRowClick={(s) => nav(`/services/${s.id}`)}
          mobileTitle={(s) => s.location}
          columns={[
            { key: 'u', header: 'Unit', render: (s) => s.location.split(', ').pop(), sort: (s) => s.location },
            { key: 'p', header: 'Plan', render: (s) => s.offeringName, sort: (s) => s.offeringName },
            { key: 's', header: 'Status', render: (s) => <StatusBadge status={s.status} />, sort: (s) => s.status },
            { key: 'a', header: 'Activated', render: (s) => date(s.activationDate) },
            { key: 'id', header: 'Service ID', render: (s) => <span className="font-mono text-xs">{s.id}</span> },
          ]}
        />
      </Card>
    </div>
  );
}

function BillingTab({ d }: { d: Awaited<ReturnType<typeof getProperty>> }) {
  const p = d.property;
  const models = [
    { id: 'Individual', desc: 'Each resident pays the operator directly. The property pays only for any common-area services.' },
    { id: 'Master', desc: 'The management organisation pays for selected services on behalf of residents.' },
    { id: 'Hybrid', desc: 'Shared connectivity is billed to the property; individual subscriptions are billed to residents.' },
    { id: 'Bulk Contract', desc: 'A master contract covers broadband for all connected units at a negotiated per-unit rate.' },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Billing arrangement">
        <div className="space-y-2">
          {models.map((m) => (
            <div key={m.id} className={m.id === p.billingModel ? 'rounded-md border border-royal bg-royal-50 p-3' : 'rounded-md border border-line-100 p-3 opacity-60'}>
              <p className="text-sm font-semibold text-navy">
                {m.id} {m.id === p.billingModel && <Tag className="ml-1">Current</Tag>}
              </p>
              <p className="text-xs text-slate-600">{m.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Changing the arrangement is a contract change: raise an Account Modification request. Billing responsibility never changes automatically when an occupant changes.</p>
        {can('request.create') && (
          <LinkButton to={`/requests/new?property=${p.id}&category=Account%20Modification`} size="sm" className="mt-2">
            Request arrangement change
          </LinkButton>
        )}
      </Card>
      <Card title="Property billing accounts">
        {d.billing.length ? (
          <ul className="space-y-2">
            {d.billing.map((b) => (
              <li key={b.id} className="rounded-md border border-line-100 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold text-navy">{b.name}</span>
                  <Tag>{b.type}</Tag>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Outstanding">{money(b.balance)}</Stat>
                  <Stat label="Overdue">{b.overdue ? <span className="font-semibold text-red-700">{money(b.overdue)}</span> : 'None'}</Stat>
                  <Stat label="Services">{b.serviceCount}</Stat>
                </dl>
                <LinkButton to="/billing?tab=invoices" size="sm" variant="ghost" className="mt-1 px-0">
                  View invoices →
                </LinkButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No property-level billing account.</p>
        )}
      </Card>
    </div>
  );
}

function RequestsTab({ d }: { d: Awaited<ReturnType<typeof getProperty>> }) {
  const nav = useNavigate();
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="Requests & maintenance" className="xl:col-span-2" actions={can('request.create') && <LinkButton size="sm" variant="primary" to={`/requests/new?property=${d.property.id}`}><LifeBuoy className="h-4 w-4" /> Raise ticket</LinkButton>}>
        <DataTable
          rows={d.requests}
          rowKey={(r) => r.id}
          onRowClick={(r) => nav(`/requests/${r.id}`)}
          mobileTitle={(r) => r.title}
          columns={[
            { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
            { key: 't', header: 'Title', render: (r) => r.title, mobileHidden: true },
            { key: 'c', header: 'Category', render: (r) => r.category },
            { key: 'p', header: 'Priority', render: (r) => <StatusBadge status={r.priority} /> },
            { key: 's', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'sla', header: 'SLA due', render: (r) => date(r.slaDue) },
          ]}
        />
      </Card>
      <Card title="Upcoming appointments">
        <ul className="space-y-2">
          {d.appointments
            .filter((a) => a.status === 'Scheduled' || a.status === 'Rescheduled')
            .sort((a, b) => a.slot.localeCompare(b.slot))
            .map((a) => (
              <li key={a.id} className="rounded-md border border-line-100 p-2 text-sm">
                <p className="font-semibold text-navy">
                  {date(a.slot)} · {a.window}
                </p>
                <p className="text-xs text-slate-600">
                  {a.unitId ? a.unitId.split('-').slice(2).join('-') : 'Property-wide'} · {a.technician}
                </p>
              </li>
            ))}
        </ul>
        <LinkButton to="/requests/appointments" size="sm" variant="ghost" className="mt-2 px-0">
          All appointments →
        </LinkButton>
      </Card>
    </div>
  );
}

function Documents({ propertyName }: { propertyName: string }) {
  const toast = useToast();
  const [docs, setDocs] = useState([
    { name: 'Right-of-way & access agreement.pdf', type: 'Agreement', date: '2024-06-20' },
    { name: 'FTTH riser design – all towers.pdf', type: 'Network design', date: '2024-07-05' },
    { name: 'Bulk services master contract.pdf', type: 'Contract', date: '2024-07-28' },
    { name: 'Fire NOC – telecom shaft.pdf', type: 'Compliance', date: '2024-07-30' },
  ]);
  return (
    <Card
      title="Documents"
      actions={
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-royal px-2.5 text-[13px] font-medium text-white hover:bg-royal-700">
          <Plus className="h-4 w-4" /> Upload
          <input
            type="file"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setDocs((d) => [{ name: f.name, type: 'Uploaded', date: new Date().toISOString().slice(0, 10) }, ...d]);
                toast('success', `${f.name} attached to ${propertyName} (stored in this browser session only)`);
              }
            }}
          />
        </label>
      }
    >
      <ul className="divide-y divide-line-100">
        {docs.map((d) => (
          <li key={d.name} className="flex items-center gap-3 py-2 text-sm">
            <FileText className="h-5 w-5 text-royal" />
            <span className="flex-1 font-medium text-navy">{d.name}</span>
            <Tag>{d.type}</Tag>
            <span className="w-28 text-right text-xs text-slate-500">{date(d.date)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

