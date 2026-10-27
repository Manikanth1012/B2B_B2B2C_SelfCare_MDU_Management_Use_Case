import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package } from 'lucide-react';
import { bulkProvisionAddOn, listProperties, listServices, listUnits, offerings } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { money } from '../../lib/format';
import { Button, Card, ErrorState, Loading, PageHeader, Select, StatusBadge, Tabs, useAction } from '../../components/ui';

export function AddonsManagement() {
  const [params, setParams] = useSearchParams();
  const propId = params.get('property') ?? '';
  const [tab, setTab] = useState<'overview' | 'bulk'>('overview');
  const [selAddOn, setSelAddOn] = useState('');
  const [selUnits, setSelUnits] = useState<string[]>([]);
  const [done, setDone] = useState<{ orderId: string; requestId: string; pendingApproval: boolean } | null>(null);
  const { run, busy } = useAction();
  const nav = useNavigate();

  const props = useApi(listProperties);
  const units = useApi(() => (propId ? listUnits(propId) : Promise.resolve([])), [propId]);
  const services = useApi(() => listServices(), [propId]);

  if (props.error) return <ErrorState error={props.error} />;
  if (!props.data) return <Loading />;

  const property = props.data.find((p) => p.id === propId);

  // Residential add-ons from all broadband + FixedVoice offerings.
  const allAddOns = offerings()
    .filter((o) => o.segment === 'Residential' && o.addOns?.length)
    .flatMap((o) => o.addOns ?? [])
    .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i); // dedupe

  // Per-unit add-on summary for Overview tab.
  const unitServices = (units.data ?? []).map((u) => {
    const svc = (services.data ?? []).filter((s) => s.unitId === u.id && s.status === 'Active');
    const activeAddOnIds = svc.flatMap((s) => s.addOns);
    const activeAddOnNames = activeAddOnIds
      .map((id) => allAddOns.find((a) => a.id === id)?.name ?? id)
      .filter(Boolean);
    return { unit: u, activeAddOnNames };
  }).filter((r) => r.unit.occupancy !== 'Vacant');

  const toggleUnit = (id: string) =>
    setSelUnits((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function submitBulk() {
    if (!selAddOn || selUnits.length === 0) return;
    const result = await run(() => Promise.resolve(bulkProvisionAddOn(propId, selUnits, selAddOn)), 'Bulk add-on order submitted');
    if (result) { setDone(result); setSelUnits([]); setSelAddOn(''); }
  }

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-2"><Package className="h-6 w-6 text-royal" /> Add-ons Management</span>}
        subtitle={property ? `${property.name}` : 'Select a property'}
        crumbs={[{ label: 'MDU Portfolio', to: '/mdu' }, property ? { label: property.name, to: `/mdu/${propId}` } : { label: 'Properties', to: '/mdu' }, { label: 'Add-ons' }]}
      />

      <div className="mb-4">
        <Select
          label="Property"
          value={propId}
          onChange={(v) => { setParams({ property: v }); setSelUnits([]); setDone(null); }}
          options={props.data.map((p) => ({ value: p.id, label: p.name }))}
          className="w-64"
        />
      </div>

      <Tabs
        active={tab}
        onChange={(t) => { setTab(t as 'overview' | 'bulk'); setDone(null); }}
        tabs={[{ id: 'overview', label: 'Overview' }, { id: 'bulk', label: 'Bulk Provision' }]}
      />

      {tab === 'overview' && (
        <Card>
          {!propId ? (
            <p className="py-6 text-center text-sm text-ink-600">Select a property.</p>
          ) : unitServices.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-600">No occupied units with active services.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-200 text-left text-xs font-bold uppercase text-ink-400">
                    <th className="py-3 pr-4">Unit</th>
                    <th className="py-3 pr-4">Occupancy</th>
                    <th className="py-3">Active Add-ons</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-100">
                  {unitServices.map(({ unit, activeAddOnNames }) => (
                    <tr key={unit.id} className="hover:bg-surface-50">
                      <td className="py-3 pr-4 font-mono text-xs text-navy">{unit.number}</td>
                      <td className="py-3 pr-4"><StatusBadge status={unit.occupancy} /></td>
                      <td className="py-3">
                        {activeAddOnNames.length === 0 ? (
                          <span className="text-ink-400">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {activeAddOnNames.map((name) => (
                              <span key={name} className="rounded-full bg-royal/10 px-2 py-0.5 text-xs font-medium text-royal">{name}</span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'bulk' && (
        <Card>
          {done ? (
            <div className="py-6 text-center">
              <p className="text-lg font-semibold text-navy">Order submitted</p>
              <p className="mt-1 text-sm text-ink-600">Order <span className="font-mono">{done.orderId}</span> · Request <span className="font-mono">{done.requestId}</span></p>
              {done.pendingApproval && <p className="mt-1 text-sm text-amber-700">Pending approval before provisioning.</p>}
              <div className="mt-4 flex justify-center gap-3">
                <Button variant="secondary" onClick={() => setDone(null)}>Provision another</Button>
                <Button onClick={() => nav(`/requests/${done.requestId}`)}>Track request</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-sm font-semibold text-navy">Step 1 — Select add-on</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {allAddOns.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelAddOn(a.id)}
                      className={`rounded-xl border p-4 text-left transition ${selAddOn === a.id ? 'border-royal bg-royal/5 shadow-sm' : 'border-line-100 hover:border-royal/40'}`}
                    >
                      <p className="font-semibold text-navy">{a.name}</p>
                      <p className="text-sm text-ink-600">{money(a.mrc, 'USD')} / month</p>
                    </button>
                  ))}
                </div>
              </div>

              {propId && selAddOn && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-navy">Step 2 — Select units</p>
                  <div className="mb-2 flex gap-2">
                    <button onClick={() => setSelUnits(unitServices.map((u) => u.unit.id))} className="text-xs font-bold text-royal hover:underline">Select all</button>
                    <button onClick={() => setSelUnits([])} className="text-xs font-bold text-ink-400 hover:underline">Clear</button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {unitServices.map(({ unit }) => (
                      <label key={unit.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition ${selUnits.includes(unit.id) ? 'border-royal bg-royal/5' : 'border-line-100 hover:border-royal/30'}`}>
                        <input type="checkbox" checked={selUnits.includes(unit.id)} onChange={() => toggleUnit(unit.id)} className="h-4 w-4 rounded" />
                        <span className="font-mono text-xs text-navy">{unit.number}</span>
                        <StatusBadge status={unit.occupancy} />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selAddOn && selUnits.length > 0 && (
                <div className="rounded-xl border border-line-100 bg-surface-50 p-4 text-sm">
                  <p className="font-semibold text-navy">Step 3 — Review & confirm</p>
                  <p className="mt-1 text-ink-600">Add-on: <b>{allAddOns.find((a) => a.id === selAddOn)?.name}</b></p>
                  <p className="text-ink-600">Units: <b>{selUnits.length}</b></p>
                  <p className="text-ink-600">Monthly impact: <b>{money((allAddOns.find((a) => a.id === selAddOn)?.mrc ?? 0) * selUnits.length, 'USD')}</b></p>
                  <Button className="mt-3" loading={busy} onClick={submitBulk}>Submit bulk provision</Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
