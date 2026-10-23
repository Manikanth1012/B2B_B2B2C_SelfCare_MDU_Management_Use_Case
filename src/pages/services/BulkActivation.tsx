import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { getSettings, listProperties, listUnits, offerings, previewBulk, submitBulk, type BulkInput, type BulkPreview } from '../../api/api';
import { TODAY } from '../../data/seed';
import { useApi } from '../../lib/hooks';
import { money } from '../../lib/format';
import { Button, Card, ErrorState, Field, inputCls, Kpi, Loading, PageHeader, Select, SimNote, StatusBadge, Stepper, useAction } from '../../components/ui';
import { CONN_STYLE, OccIcon } from '../mdu/BuildingsUnits';

const STEPS = ['Property', 'Units', 'Plan', 'Billing', 'Availability & review', 'Submit'];

export function BulkActivation() {
  const [params] = useSearchParams();
  const props = useApi(listProperties);
  const [pid, setPid] = useState(params.get('property') ?? '');
  const units = useApi(() => (pid ? listUnits(pid) : Promise.resolve([])), [pid]);
  const [sel, setSel] = useState<string[]>(params.get('units')?.split(',').filter(Boolean) ?? []);
  const [tower, setTower] = useState('All');
  const [planMode, setPlanMode] = useState<'common' | 'per-unit'>('common');
  const [common, setCommon] = useState('OFF-R02');
  const [perUnit, setPerUnit] = useState<Record<string, string>>({});
  const [billingResp, setBillingResp] = useState<'property' | 'resident'>('property');
  const [from, setFrom] = useState('2026-10-28');
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [step, setStep] = useState(params.get('units') ? 2 : params.get('property') ? 1 : 0);
  const { run, busy } = useAction();
  const nav = useNavigate();
  const prop = props.data?.find((p) => p.id === pid);
  useEffect(() => {
    if (prop && !prop.masterBillingId) setBillingResp('resident');
  }, [prop]);

  if (props.error) return <ErrorState error={props.error} />;
  if (!props.data) return <Loading />;
  const resi = offerings().filter((o) => o.segment === 'Residential' && (!prop || !o.techRequired || o.techRequired.includes(prop.technology)));
  const input: BulkInput = { propertyId: pid, unitIds: sel, plan: planMode === 'common' ? { mode: 'common', offeringId: common } : { mode: 'per-unit', map: Object.fromEntries(sel.map((u) => [u, perUnit[u] ?? common])) }, billing: billingResp, appointmentFrom: from };
  const candidates = (units.data ?? []).filter((u) => (tower === 'All' || u.building === tower) && (u.connectivity === 'Ready for Service' || u.connectivity === 'Network Not Ready'));
  const towers = [...new Set((units.data ?? []).map((u) => u.building))];
  const valid = [!!pid, sel.length > 0, planMode === 'common' ? !!common : true, true, !!preview?.eligible.length];

  const goNext = async () => {
    if (step === 3) {
      const p = await run(() => previewBulk(input));
      if (!p) return;
      setPreview(p);
    }
    setStep((s) => s + 1);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Bulk Service Activation" subtitle="Activate broadband for many units in one controlled order. Ineligible units are rejected individually — the rest proceed." crumbs={[{ label: 'Services', to: '/services' }, { label: 'Bulk activation' }]} />
      <Stepper steps={STEPS} current={step} />
      <Card>
        {step === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {props.data.map((p) => (
              <button key={p.id} onClick={() => (setPid(p.id), setSel([]))} className={clsx('rounded-lg border p-3 text-left text-sm', pid === p.id ? 'border-crimson bg-crimson-50 ring-1 ring-crimson' : 'border-line-200 hover:border-crimson')}>
                <p className="font-medium text-navy">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.technology} · {p.ready} units ready for service · {p.billingModel} billing
                </p>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Select label="Tower" value={tower} onChange={setTower} options={['All', ...towers]} className="w-40" />
              <Button size="sm" variant="secondary" onClick={() => setSel([...new Set([...sel, ...candidates.filter((u) => u.connectivity === 'Ready for Service').map((u) => u.id)])])}>
                Select all ready
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSel([])}>
                Clear
              </Button>
              <span className="ml-auto text-sm text-ink-700">
                <b>{sel.length}</b> selected
              </span>
            </div>
            <p className="mb-2 text-xs text-slate-500">Units without service are listed. Not-ready units may be selected — they will fail the availability check, demonstrating per-unit rejection.</p>
            {!units.data ? (
              <Loading />
            ) : (
              <div className="grid max-h-[420px] grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-6 lg:grid-cols-8">
                {candidates.map((u) => (
                  <button key={u.id} onClick={() => setSel(sel.includes(u.id) ? sel.filter((x) => x !== u.id) : [...sel, u.id])} className={clsx('flex h-12 flex-col items-center justify-center rounded-md border text-xs font-semibold', CONN_STYLE[u.connectivity].tile, sel.includes(u.id) && 'ring-4 ring-crimson ring-offset-1')} aria-pressed={sel.includes(u.id)}>
                    {u.number}
                    <span className="flex items-center gap-0.5 text-[10px]">
                      <OccIcon o={u.occupancy} className="h-3 w-3" /> {CONN_STYLE[u.connectivity].short}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex rounded-full border border-line-200 bg-white p-1 sm:w-fit">
              {(['common', 'per-unit'] as const).map((m) => (
                <button key={m} onClick={() => setPlanMode(m)} className={clsx('flex-1 rounded-full px-4 py-1.5 text-sm font-medium', planMode === m ? 'bg-brand text-white' : 'text-ink-600')}>
                  {m === 'common' ? 'Common plan for all' : 'Per-unit plan'}
                </button>
              ))}
            </div>
            <Field label={planMode === 'common' ? 'Plan' : 'Default plan'}>
              <Select label="Plan" value={common} onChange={setCommon} options={resi.map((o) => ({ value: o.id, label: `${o.name} – ${money(o.mrc)}/mo` }))} />
            </Field>
            {planMode === 'per-unit' && (
              <div className="max-h-80 overflow-y-auto rounded border border-line-200">
                {sel.map((u) => (
                  <div key={u} className="flex items-center gap-3 border-b border-line-100 px-3 py-1.5 text-sm last:border-0">
                    <span className="w-20 font-semibold">{units.data?.find((x) => x.id === u)?.number}</span>
                    <Select label={`Plan for ${u}`} value={perUnit[u] ?? common} onChange={(v) => setPerUnit({ ...perUnit, [u]: v })} options={resi.map((o) => ({ value: o.id, label: o.name }))} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { id: 'property', label: 'Bill to property', desc: prop?.masterBillingId ? `Charges go to ${prop.masterBillingId} (${prop.billingModel}).` : 'This property has no property billing account.', disabled: !prop?.masterBillingId },
                { id: 'resident', label: 'Bill each resident', desc: 'A resident billing account per occupied unit. Units without an occupant are rejected.', disabled: false },
              ].map((o) => (
                <button key={o.id} disabled={o.disabled} onClick={() => setBillingResp(o.id as 'property')} className={clsx('rounded-lg border p-3 text-left text-sm disabled:opacity-50', billingResp === o.id ? 'border-crimson bg-crimson-50 ring-1 ring-crimson' : 'border-line-200')}>
                  <p className="font-medium text-navy">{o.label}</p>
                  <p className="text-xs text-slate-500">{o.desc}</p>
                </button>
              ))}
            </div>
            <Field label="Installations from" hint="Field teams schedule unit visits from this date">
              <input type="date" className={inputCls} value={from} min={TODAY} onChange={(e) => setFrom(e.target.value)} />
            </Field>
          </div>
        )}

        {step === 4 && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Eligible units" value={preview.eligible.length} tone="green" />
              <Kpi label="Rejected at check" value={preview.ineligible.length} tone={preview.ineligible.length ? 'red' : 'default'} />
              <Kpi label="New MRC" value={money(preview.mrcTotal)} />
              <Kpi label="One-time charges" value={money(preview.nrcTotal)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-semibold text-navy">Eligible</p>
                <ul className="max-h-60 overflow-y-auto rounded border border-line-200 text-sm">
                  {preview.eligible.map((e) => (
                    <li key={e.unitId} className="flex justify-between border-b border-line-100 px-3 py-1 last:border-0">
                      <span className="font-semibold">{e.number}</span>
                      <span className="text-xs text-slate-600">{offerings().find((o) => o.id === e.offeringId)?.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold text-navy">Rejected</p>
                <ul className="max-h-60 overflow-y-auto rounded border border-red-200 bg-red-50/50 text-sm">
                  {preview.ineligible.map((e) => (
                    <li key={e.unitId} className="border-b border-red-100 px-3 py-1 last:border-0">
                      <span className="font-semibold">{e.number}</span> <span className="text-xs text-red-800">— {e.reason}</span>
                    </li>
                  ))}
                  {!preview.ineligible.length && <li className="px-3 py-1 text-xs text-slate-500">None</li>}
                </ul>
              </div>
            </div>
            {getSettings().approvalForBulkActivation && <p className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">Bulk activation requires operator approval before provisioning starts.</p>}
            <SimNote />
          </div>
        )}

        {step === 5 && (
          <div className="py-6 text-center">
            <p className="mb-4 text-sm text-ink-700">
              Submit a bulk order for <b>{preview?.eligible.length}</b> units at <b>{prop?.name}</b>? Rejected units ({preview?.ineligible.length}) are recorded on the order as failed items.
            </p>
            <Button
              variant="cta"
              loading={busy}
              onClick={async () => {
                const r = await run(() => submitBulk(input), (x) => (x.pendingApproval ? 'Bulk order submitted – awaiting approval' : 'Bulk order submitted'));
                if (r) nav(`/services/orders/${r.orderId}`);
              }}
            >
              Submit bulk request
            </Button>
          </div>
        )}

        <div className="mt-6 flex justify-between border-t border-line-100 pt-4">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          {step < STEPS.length - 1 && (
            <Button disabled={!valid[step]} loading={busy} onClick={goNext}>
              {step === 3 ? 'Run availability checks' : 'Continue'}
            </Button>
          )}
        </div>
      </Card>
      {prop && step > 0 && (
        <p className="mt-3 text-center text-xs text-slate-500">
          {prop.name}: {prop.technology}, capacity {prop.capacityPorts} ports, <StatusBadge status={prop.readiness} />
        </p>
      )}
    </div>
  );
}
