import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listRequests, listServices } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date, money } from '../../lib/format';
import { Card, DataTable, ErrorState, Loading, PageHeader, SearchBox, StatusBadge } from '../../components/ui';

async function load() {
  const [services, requests] = await Promise.all([listServices(), listRequests()]);
  return { services, requests: requests.filter((r) => r.category === 'Plan Change' || r.category === 'Service Suspension') };
}

export function PlanChanges() {
  const q = useApi(load);
  const [search, setSearch] = useState('');
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const changeable = q.data.services.filter((s) => (s.status === 'Active' || s.status === 'Suspended') && !s.pendingChange && (!search || `${s.offeringName} ${s.location} ${s.id}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <div>
      <PageHeader title="Plan Changes" subtitle="Upgrade, downgrade, suspend or reactivate subscriptions. Every change is an order — tracked, never silent." crumbs={[{ label: 'Services', to: '/services' }, { label: 'Plan changes' }]} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Pending and recent change orders">
          <DataTable
            rows={q.data.requests}
            rowKey={(r) => r.id}
            onRowClick={(r) => nav(`/requests/${r.id}`)}
            mobileTitle={(r) => r.title}
            empty="No change orders yet."
            columns={[
              { key: 't', header: 'Change', render: (r) => r.title, mobileHidden: true },
              { key: 's', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'd', header: 'Submitted', render: (r) => date(r.createdAt) },
            ]}
          />
        </Card>
        <Card title="Start a change" actions={<div className="w-56"><SearchBox value={search} onChange={setSearch} placeholder="Find a service" /></div>}>
          <DataTable
            rows={changeable}
            rowKey={(s) => s.id}
            mobileTitle={(s) => s.offeringName}
            columns={[
              { key: 'p', header: 'Service', render: (s) => <span className="font-medium">{s.offeringName}</span>, mobileHidden: true },
              { key: 'l', header: 'Location', render: (s) => <span className="text-xs">{s.location}</span> },
              { key: 'm', header: 'MRC', render: (s) => money(s.mrc, s.currency) },
              {
                key: 'a',
                header: 'Action',
                render: (s) =>
                  s.status === 'Active' ? (
                    <span className="flex gap-2 text-xs font-semibold">
                      <button className="text-royal hover:underline" onClick={() => nav(`/services/${s.id}?action=plan`)}>
                        Change plan
                      </button>
                      <button className="text-royal hover:underline" onClick={() => nav(`/services/${s.id}?action=suspend`)}>
                        Suspend
                      </button>
                    </span>
                  ) : (
                    <button className="text-xs font-semibold text-royal hover:underline" onClick={() => nav(`/services/${s.id}?action=resume`)}>
                      Reactivate
                    </button>
                  ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
