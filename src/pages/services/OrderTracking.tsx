import { useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import { getOrder, simulateFulfilment } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { dateTime } from '../../lib/format';
import { Button, Card, DataTable, ErrorState, Kpi, LinkButton, Loading, PageHeader, ProgressBar, SimNote, StatusBadge, useAction } from '../../components/ui';

export function OrderTracking() {
  const { id = '' } = useParams();
  const q = useApi(() => getOrder(id), [id]);
  const { run, busy } = useAction();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const o = q.data;
  const count = (s: string) => o.items.filter((i) => i.status === s).length;
  const finished = count('Completed') + count('Failed');
  const awaiting = count('Awaiting Approval');
  const open = count('Queued') + count('In Progress');
  return (
    <div>
      <PageHeader
        title={`Order ${o.id}`}
        subtitle={`${o.kind} · created ${dateTime(o.createdAt)} · ${o.appointment ?? ''}`}
        crumbs={[{ label: 'Services', to: '/services' }, { label: 'Order tracking' }]}
        actions={
          <>
            <LinkButton to={`/requests/${o.requestId}`}>View request {o.requestId}</LinkButton>
            <Button onClick={() => run(() => simulateFulfilment(o.id), 'Provisioning step simulated')} loading={busy} disabled={!open}>
              <Play className="h-4 w-4" /> Simulate next provisioning step
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Units / items" value={o.items.length} />
        <Kpi label="Awaiting approval" value={awaiting} tone={awaiting ? 'orange' : 'default'} />
        <Kpi label="Queued / in progress" value={open} />
        <Kpi label="Completed" value={count('Completed')} tone="green" />
        <Kpi label="Failed" value={count('Failed')} tone={count('Failed') ? 'red' : 'default'} />
      </div>
      <Card title="Per-unit activation status">
        <div className="mb-4">
          <ProgressBar value={finished} max={o.items.length} tone="green" label="Order progress" />
          <p className="mt-1 text-xs text-slate-600">
            {finished} of {o.items.length} items finished
            {awaiting ? ' · provisioning starts once the operator approves' : ''}
          </p>
        </div>
        <DataTable
          rows={o.items}
          rowKey={(i) => (i.unitId ?? i.serviceId ?? '') + i.status}
          pageSize={20}
          mobileTitle={(i) => i.unitNumber ?? i.serviceId}
          columns={[
            { key: 'u', header: 'Unit / service', render: (i) => <span className="font-semibold">{i.unitNumber ?? i.serviceId}</span>, sort: (i) => i.unitNumber ?? '', mobileHidden: true },
            { key: 'p', header: 'Plan', render: (i) => i.offeringName ?? '—' },
            { key: 's', header: 'Status', render: (i) => <StatusBadge status={i.status} />, sort: (i) => i.status },
            { key: 'n', header: 'Note', render: (i) => <span className="text-xs text-slate-600">{i.note ?? ''}</span> },
            { key: 'id', header: 'Service', render: (i) => <span className="font-mono text-xs">{i.serviceId ?? '—'}</span> },
          ]}
        />
      </Card>
      <div className="mt-4">
        <SimNote>Each click advances queued items to in-progress, then to completed or failed. About one in seven installs fails (e.g. no access on appointment day) so partial success is visible. Completed items activate the subscription.</SimNote>
      </div>
    </div>
  );
}
