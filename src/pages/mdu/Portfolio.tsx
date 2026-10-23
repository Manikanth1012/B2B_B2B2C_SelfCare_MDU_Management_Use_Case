import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Building2, LayoutGrid, MapPin, Plus, Table2, Upload } from 'lucide-react';
import { can, listProperties, type PropertyRow } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { pct } from '../../lib/format';
import { Card, DataTable, ErrorState, Kpi, LinkButton, Loading, PageHeader, ProgressBar, SearchBox, Select, StatusBadge, Tag } from '../../components/ui';

export function Portfolio() {
  const q = useApi(listProperties);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const all = q.data;
  const rows = all.filter((p) => (status === 'All statuses' || p.status === status) && (!search || `${p.name} ${p.id} ${p.city} ${p.managerName}`.toLowerCase().includes(search.toLowerCase())));
  const sum = (k: keyof PropertyRow) => all.reduce((a, p) => a + (p[k] as number), 0);

  return (
    <div>
      <PageHeader
        title="MDU Portfolio"
        subtitle="Residential communities and multi-dwelling properties you manage."
        crumbs={[{ label: 'Dashboard', to: '/' }, { label: 'MDU Management' }]}
        actions={
          <>
            {can('unit.manage') && (
              <LinkButton to="/mdu/import">
                <Upload className="h-4 w-4" /> Bulk onboarding
              </LinkButton>
            )}
            {can('property.create') && (
              <LinkButton to="/mdu/new" variant="primary">
                <Plus className="h-4 w-4" /> Add property
              </LinkButton>
            )}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Total properties" value={all.length} />
        <Kpi label="Total buildings" value={sum('buildings')} />
        <Kpi label="Total units" value={sum('totalUnits')} />
        <Kpi label="Connected units" value={sum('connected')} tone="green" hint={`${pct(sum('connected'), sum('totalUnits'))}% penetration`} />
        <Kpi label="Vacant units" value={sum('vacant')} hint="Occupancy, not connectivity" />
        <Kpi label="Pending activations" value={sum('pending')} tone="orange" to="/requests/appointments" />
        <Kpi label="Open property tickets" value={sum('openTickets')} to="/requests" />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <SearchBox value={search} onChange={setSearch} placeholder="Search property, ID, city or manager" />
        </div>
        <Select label="Status" value={status} onChange={setStatus} options={['All statuses', 'Live', 'Onboarding', 'Pending Approval']} className="w-44" />
        <div className="flex rounded-full border border-line-200 bg-white p-1">
          <button aria-label="Card view" aria-pressed={view === 'cards'} onClick={() => setView('cards')} className={clsx('rounded-full p-1.5', view === 'cards' ? 'bg-brand text-white' : 'text-slate-600')}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button aria-label="Table view" aria-pressed={view === 'table'} onClick={() => setView('table')} className={clsx('rounded-full p-1.5', view === 'table' ? 'bg-brand text-white' : 'text-slate-600')}>
            <Table2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {view === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <button key={p.id} onClick={() => nav(`/mdu/${p.id}`)} className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-crimson hover:shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-royal-50 text-royal">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold text-navy">{p.name}</p>
                    <p className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3" /> {p.city} · {p.id}
                    </p>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                {[
                  ['Buildings', p.buildings],
                  ['Units', p.totalUnits],
                  ['Connected', p.connected],
                  ['Vacant', p.vacant],
                ].map(([l, v]) => (
                  <div key={l as string} className="rounded bg-slate-50 py-1.5">
                    <p className="font-bold text-navy">{v}</p>
                    <p className="text-slate-500">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-600">Connectivity penetration</span>
                  <span className="font-semibold">{pct(p.connected, p.totalUnits)}%</span>
                </div>
                <ProgressBar value={p.connected} max={p.totalUnits} tone="green" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Tag>{p.technology}</Tag>
                <StatusBadge status={p.readiness} />
                <span className="text-slate-500">{p.billingModel} billing</span>
                <span className="ml-auto text-slate-500">Mgr: {p.managerName}</span>
              </div>
            </button>
          ))}
          {!rows.length && <p className="col-span-full py-10 text-center text-sm text-slate-500">No properties match your filters.</p>}
        </div>
      ) : (
        <Card>
          <DataTable
            rows={rows}
            rowKey={(p) => p.id}
            onRowClick={(p) => nav(`/mdu/${p.id}`)}
            mobileTitle={(p) => p.name}
            columns={[
              { key: 'id', header: 'MDU ID', render: (p) => <span className="font-mono text-xs">{p.id}</span>, sort: (p) => p.id },
              { key: 'n', header: 'Property', render: (p) => <span className="font-semibold">{p.name}</span>, sort: (p) => p.name, mobileHidden: true },
              { key: 'm', header: 'Property manager', render: (p) => p.managerName },
              { key: 'a', header: 'Address', render: (p) => `${p.address}, ${p.city}` },
              { key: 'b', header: 'Buildings', render: (p) => p.buildings, sort: (p) => p.buildings },
              { key: 'u', header: 'Units', render: (p) => p.totalUnits, sort: (p) => p.totalUnits },
              { key: 'c', header: 'Connected', render: (p) => `${p.connected} (${pct(p.connected, p.totalUnits)}%)`, sort: (p) => p.connected },
              { key: 'r', header: 'Readiness', render: (p) => <StatusBadge status={p.readiness} /> },
              { key: 's', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
