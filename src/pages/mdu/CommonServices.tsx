import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Wifi, Video, Phone, Settings } from 'lucide-react';
import { can, getProperty, listProperties, listPropertyOfferings, modifyPropertyService, orderPropertyService } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { money, date } from '../../lib/format';
import { Button, Card, DataTable, ErrorState, Field, inputCls, Kpi, Loading, Modal, PageHeader, Select, SimNote, StatusBadge, useAction } from '../../components/ui';

const CATEGORY_ICON: Record<string, typeof Wifi> = {
  'Managed Services': Wifi,
  'IoT': Video,
  'Voice': Phone,
};

export function CommonServices() {
  const [params, setParams] = useSearchParams();
  const propId = params.get('property') ?? '';
  const props = useApi(listProperties);
  const q = useApi(() => (propId ? getProperty(propId) : Promise.resolve(null)), [propId]);
  const [ordering, setOrdering] = useState(false);
  const { run, busy } = useAction();
  const nav = useNavigate();

  useEffect(() => {
    if (props.data && !propId && props.data.length > 0) {
      setParams({ property: props.data[0].id }, { replace: true });
    }
  }, [props.data, propId, setParams]);

  if (props.error || q.error) return <ErrorState error={props.error ?? q.error!} />;
  if (!props.data) return <Loading />;

  const property = props.data.find((p) => p.id === propId);
  const shared = (q.data?.services ?? []).filter((s) => !s.unitId);
  const active = shared.filter((s) => s.status === 'Active').length;
  const pending = shared.filter((s) => s.status === 'Pending Installation').length;
  const mrcTotal = shared.filter((s) => s.status === 'Active').reduce((a, s) => a + s.mrc, 0);

  async function handleModify(serviceId: string, action: 'Suspend' | 'Resume' | 'Terminate') {
    await run(() => modifyPropertyService(serviceId, action), `Service ${action.toLowerCase()}d`);
  }

  return (
    <div>
      <PageHeader
        title="Common Area Services"
        subtitle={property ? `${property.name} — shared property-level services` : 'Select a property to view and manage shared services'}
        crumbs={[{ label: 'MDU Portfolio', to: '/mdu' }, property ? { label: property.name, to: `/mdu/${propId}` } : { label: 'Properties', to: '/mdu' }, { label: 'Common Services' }]}
        actions={
          propId && can('service.order') && (
            <Button onClick={() => setOrdering(true)} disabled={!q.data?.property.masterBillingId}>
              <Plus className="h-4 w-4" /> Order service
            </Button>
          )
        }
      />

      <div className="mb-4">
        <Select
          label="Property"
          value={propId}
          onChange={(v) => setParams({ property: v })}
          options={props.data.map((p) => ({ value: p.id, label: p.name }))}
          className="w-72"
        />
      </div>

      {propId && !q.data?.property.masterBillingId && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This property has no master billing account — common area services cannot be ordered until one is set up.
        </div>
      )}

      {propId && q.data && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi label="Active services" value={active} tone="green" />
            <Kpi label="Pending installation" value={pending} tone="orange" />
            <Kpi label="Monthly recurring cost" value={money(mrcTotal)} tone="teal" />
          </div>

          {shared.length === 0 ? (
            <Card>
              <div className="py-10 text-center">
                <Settings className="mx-auto mb-3 h-10 w-10 text-ink-300" />
                <p className="text-sm font-medium text-ink-600">No common area services yet</p>
                <p className="mt-1 text-xs text-ink-400">Order Wi-Fi, CCTV, voice lines and other shared services for this property.</p>
                {can('service.order') && q.data.property.masterBillingId && (
                  <Button className="mt-4" onClick={() => setOrdering(true)}>
                    <Plus className="h-4 w-4" /> Order first service
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <DataTable
              rows={shared}
              rowKey={(s) => s.id}
              onRowClick={(s) => nav(`/services/${s.id}`)}
              mobileTitle={(s) => s.offeringName}
              columns={[
                {
                  key: 'p', header: 'Service', render: (s) => {
                    const Icon = CATEGORY_ICON[s.offeringName ? (s as any).category ?? '' : ''] ?? Settings;
                    return (
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-royal" />
                        <span className="font-semibold text-navy">{s.offeringName}</span>
                      </span>
                    );
                  }
                },
                { key: 'l', header: 'Location', render: (s) => s.location },
                { key: 's', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
                { key: 'a', header: 'Active since', render: (s) => date(s.activationDate) },
                { key: 'm', header: 'MRC', render: (s) => money(s.mrc) },
                { key: 'e', header: 'Contract ends', render: (s) => date(s.contractEnd) },
                {
                  key: 'act', header: 'Actions', mobileHidden: true,
                  render: (s) => can('service.order') ? (
                    <span className="flex gap-3 text-xs font-bold" onClick={(e) => e.stopPropagation()}>
                      {s.status === 'Active' && (
                        <button className="text-amber-600 hover:underline" onClick={() => handleModify(s.id, 'Suspend')} disabled={busy}>Suspend</button>
                      )}
                      {s.status === 'Suspended' && (
                        <button className="text-green-700 hover:underline" onClick={() => handleModify(s.id, 'Resume')} disabled={busy}>Resume</button>
                      )}
                      {s.status !== 'Terminated' && (
                        <button className="text-crimson hover:underline" onClick={() => handleModify(s.id, 'Terminate')} disabled={busy}>Terminate</button>
                      )}
                    </span>
                  ) : null,
                },
              ]}
            />
          )}
        </>
      )}

      {ordering && propId && (
        <OrderModal propId={propId} propName={property?.name ?? ''} onClose={() => setOrdering(false)} />
      )}
    </div>
  );
}

function OrderModal({ propId, propName, onClose }: { propId: string; propName: string; onClose: () => void }) {
  const offerings = listPropertyOfferings();
  const [offeringId, setOfferingId] = useState(offerings[0]?.id ?? '');
  const [location, setLocation] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [done, setDone] = useState<{ requestId: string; orderId: string } | null>(null);
  const { run, busy } = useAction();
  const nav = useNavigate();

  const offering = offerings.find((o) => o.id === offeringId);

  async function submit() {
    const res = await run(
      () => orderPropertyService({ propertyId: propId, offeringId, location: location || `${propName} – Common area`, appointmentDate }),
      'Service order submitted',
    );
    if (res) setDone(res as { requestId: string; orderId: string });
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Order Common Area Service"
      footer={
        done ? (
          <>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={() => nav(`/requests/${done.requestId}`)}>View request</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button loading={busy} disabled={!offeringId || !appointmentDate} onClick={submit}>Submit order</Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-3 text-center py-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <Settings className="h-6 w-6 text-green-600" />
          </div>
          <p className="font-semibold text-navy">Order submitted successfully</p>
          <p className="text-sm text-ink-600">Request <span className="font-mono font-bold">{done.requestId}</span> has been raised and assigned to MDU Provisioning.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="Service" required>
            <select className={inputCls} value={offeringId} onChange={(e) => setOfferingId(e.target.value)}>
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>{o.name} — {money(o.mrc)}/mo</option>
              ))}
            </select>
          </Field>
          {offering && (
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-surface-50 p-3 text-sm">
              <div><p className="text-xs text-ink-400">Category</p><p className="font-medium">{offering.category}</p></div>
              <div><p className="text-xs text-ink-400">MRC</p><p className="font-medium">{money(offering.mrc)}/mo</p></div>
              <div><p className="text-xs text-ink-400">Contract</p><p className="font-medium">{offering.contractMonths} months</p></div>
            </div>
          )}
          <Field label="Location / description" hint="e.g. Clubhouse & lobbies, Perimeter CCTV, Lift emergency lines">
            <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={`${propName} – Common area`} />
          </Field>
          <Field label="Preferred installation date" required>
            <input type="date" className={inputCls} value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
          </Field>
          <SimNote>Order is submitted and assigned to MDU Provisioning. Installation is scheduled for the morning slot on your chosen date.</SimNote>
        </div>
      )}
    </Modal>
  );
}
