import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { can, listServices } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date, downloadText, money, toCsv } from '../../lib/format';
import { Button, Card, DataTable, ErrorState, Kpi, LinkButton, Loading, PageHeader, SearchBox, Select, StatusBadge } from '../../components/ui';

export function ServicesList() {
  const q = useApi(listServices);
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [acc, setAcc] = useState('All accounts');
  const [prop, setProp] = useState('All properties');
  const [cat, setCat] = useState('All types');
  const [status, setStatus] = useState(params.get('status') ?? 'All statuses');
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const all = q.data;
  const accounts = [...new Set(all.filter((s) => s.owner.kind === 'business').map((s) => s.customerName))].sort();
  const properties = [...new Set(all.filter((s) => s.propertyId).map((s) => s.location.split(',')[0].split(' –')[0]))].sort();
  const rows = all.filter(
    (s) =>
      (acc === 'All accounts' || s.customerName === acc) &&
      (prop === 'All properties' || s.location.startsWith(prop)) &&
      (cat === 'All types' || s.category === cat) &&
      (status === 'All statuses' || s.status === status) &&
      (!search || `${s.id} ${s.offeringName} ${s.customerName} ${s.location}`.toLowerCase().includes(search.toLowerCase())),
  );
  return (
    <div>
      <PageHeader
        title="Service Portfolio"
        subtitle="All services across your authorised business accounts and properties."
        crumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Services' }]}
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadText('services.csv', toCsv([['Service ID', 'Product', 'Customer', 'Location', 'Status', 'Activated', 'MRC'], ...rows.map((s) => [s.id, s.offeringName, s.customerName, s.location, s.status, s.activationDate, s.mrc])]))}>
              Export CSV
            </Button>
            {can('service.order') && (
              <LinkButton to="/services/new" variant="primary">
                <Plus className="h-4 w-4" /> New connection
              </LinkButton>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Active" value={all.filter((s) => s.status === 'Active').length} tone="green" />
        <Kpi label="Pending installation" value={all.filter((s) => s.status === 'Pending Installation').length} tone="orange" />
        <Kpi label="Pending change" value={all.filter((s) => s.status === 'Pending Change' || s.pendingChange).length} />
        <Kpi label="Suspended" value={all.filter((s) => s.status === 'Suspended').length} />
      </div>
      <Card>
        <div className="mb-3 grid gap-2 md:grid-cols-5">
          <div className="md:col-span-1">
            <SearchBox value={search} onChange={setSearch} placeholder="Search services" />
          </div>
          <Select label="Business account" value={acc} onChange={setAcc} options={['All accounts', ...accounts]} />
          <Select label="Property" value={prop} onChange={setProp} options={['All properties', ...properties]} />
          <Select label="Service type" value={cat} onChange={setCat} options={['All types', 'FTTH Broadband', 'Leased Line', 'SD-WAN', 'Voice', 'IoT', 'Managed Services']} />
          <Select label="Status" value={status} onChange={setStatus} options={['All statuses', 'Active', 'Pending Installation', 'Pending Change', 'Suspended', 'Terminated']} />
        </div>
        <DataTable
          rows={rows}
          rowKey={(s) => s.id}
          onRowClick={(s) => nav(`/services/${s.id}`)}
          pageSize={15}
          mobileTitle={(s) => s.offeringName}
          columns={[
            { key: 'id', header: 'Service ID', render: (s) => <span className="font-mono text-xs">{s.id}</span>, sort: (s) => s.id },
            { key: 'p', header: 'Product', render: (s) => <span className="font-medium text-navy">{s.offeringName}</span>, sort: (s) => s.offeringName, mobileHidden: true },
            { key: 'c', header: 'Customer / account', render: (s) => s.customerName, sort: (s) => s.customerName },
            { key: 'l', header: 'Service location', render: (s) => s.location },
            { key: 'u', header: 'Unit', render: (s) => s.unitNumber ?? '—' },
            { key: 'a', header: 'Activated', render: (s) => date(s.activationDate), sort: (s) => s.activationDate ?? '' },
            { key: 's', header: 'Status', render: (s) => <StatusBadge status={s.status} />, sort: (s) => s.status },
            { key: 'm', header: 'MRC', render: (s) => money(s.mrc, s.currency), sort: (s) => s.mrc, className: 'text-right' },
          ]}
        />
      </Card>
    </div>
  );
}
