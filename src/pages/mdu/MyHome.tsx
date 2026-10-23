import { useNavigate } from 'react-router-dom';
import { Home, LifeBuoy, Receipt, Wifi } from 'lucide-react';
import { currentUser, getUnit, listInvoices, listRequests } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date, money } from '../../lib/format';
import { Card, DataTable, ErrorState, Kpi, LinkButton, Loading, PageHeader, Stat, StatusBadge } from '../../components/ui';

async function load() {
  const user = currentUser();
  const unitId = user.scopes.find((s) => s.kind === 'unit')?.ref;
  if (!unitId) throw Object.assign(new Error('No unit is linked to your account.'), { name: 'AuthError' });
  const [unit, invoices, requests] = await Promise.all([getUnit(unitId), listInvoices(), listRequests()]);
  return { unit, invoices, requests };
}

export function MyHome() {
  const user = currentUser();
  const q = useApi(load, [user.id]);
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const { unit, invoices, requests } = q.data;
  const sub = unit.services[0];
  const open = invoices.filter((i) => i.status !== 'Paid');
  return (
    <div>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle={`${unit.propertyName} · ${unit.building} · Unit ${unit.number}`} crumbs={[{ label: 'My Home' }]} actions={<LinkButton to={`/requests/new?unit=${unit.id}`} variant="primary"><LifeBuoy className="h-4 w-4" /> Raise a request</LinkButton>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Connection" value={<StatusBadge status={unit.connectivity} />} icon={<Wifi className="h-4 w-4" />} />
        <Kpi label="Current plan" value={<span className="text-base">{sub?.offeringName ?? 'None'}</span>} />
        <Kpi label="Amount due" value={money(open.reduce((a, i) => a + i.amount, 0))} tone={open.some((i) => i.status === 'Overdue') ? 'red' : 'default'} icon={<Receipt className="h-4 w-4" />} to="/billing/invoices" />
        <Kpi label="Open requests" value={requests.filter((r) => !['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(r.status)).length} to="/requests" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="My subscription" className="lg:col-span-2" actions={sub && <LinkButton size="sm" to={`/services/${sub.id}`}>Manage</LinkButton>}>
          {sub ? (
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Stat label="Plan">{sub.offeringName}</Stat>
              <Stat label="Status">
                <StatusBadge status={sub.status} />
              </Stat>
              <Stat label="Monthly charge">{money(sub.mrc)}</Stat>
              <Stat label="Service ID">{sub.id}</Stat>
              <Stat label="Active since">{date(sub.activationDate)}</Stat>
              <Stat label="Contract ends">{date(sub.contractEnd)}</Stat>
              <Stat label="Equipment">{sub.equipment.map((e) => e.type).join(', ')}</Stat>
              <Stat label="Billing">{sub.billedTo}</Stat>
              {sub.pendingChange && <Stat label="Pending change">{sub.pendingChange}</Stat>}
            </dl>
          ) : (
            <div className="text-sm text-slate-600">
              No active subscription. <LinkButton to={`/services/new?unit=${unit.id}`} size="sm" variant="primary">Request broadband</LinkButton>
            </div>
          )}
        </Card>
        <Card title="My unit">
          <dl className="space-y-3">
            <Stat label="Address">
              <span className="flex items-center gap-1">
                <Home className="h-4 w-4 text-royal" /> {unit.number}, {unit.building}, {unit.propertyName}
              </span>
            </Stat>
            <Stat label="Unit type">{unit.unitType}</Stat>
            <Stat label="Registered occupant">{unit.occupant ? `${unit.occupant.name} (${unit.occupant.role})` : '—'}</Stat>
          </dl>
          <p className="mt-3 text-[11px] text-slate-500">You can only see your own unit, subscriptions, bills and requests.</p>
        </Card>
        <Card title="Recent bills" className="lg:col-span-2" actions={<LinkButton size="sm" variant="ghost" to="/billing/invoices">All bills</LinkButton>}>
          <DataTable
            rows={invoices.slice(0, 4)}
            rowKey={(i) => i.id}
            onRowClick={() => nav('/billing/invoices')}
            mobileTitle={(i) => i.period}
            columns={[
              { key: 'p', header: 'Period', render: (i) => i.period },
              { key: 'id', header: 'Invoice', render: (i) => <span className="font-mono text-xs">{i.id}</span> },
              { key: 'a', header: 'Amount', render: (i) => money(i.amount) },
              { key: 'd', header: 'Due', render: (i) => date(i.dueDate) },
              { key: 's', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
            ]}
          />
        </Card>
        <Card title="My requests" actions={<LinkButton size="sm" variant="ghost" to="/requests">All</LinkButton>}>
          <ul className="space-y-2">
            {requests.slice(0, 4).map((r) => (
              <li key={r.id}>
                <button onClick={() => nav(`/requests/${r.id}`)} className="w-full rounded-md border border-line-100 p-2 text-left text-sm hover:border-crimson">
                  <p className="font-medium text-navy">{r.title}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <StatusBadge status={r.status} />
                    <span className="text-xs text-slate-500">{date(r.createdAt)}</span>
                  </div>
                </button>
              </li>
            ))}
            {!requests.length && <p className="text-sm text-slate-500">No requests yet.</p>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
