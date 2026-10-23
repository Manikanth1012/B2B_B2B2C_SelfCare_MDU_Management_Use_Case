import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { CheckCircle2, Radar } from 'lucide-react';
import { can, checkAvailability, currentUser, getUnit, listAccounts, listBillingAccounts, listProperties, listUnits, offerings, submitNewConnection } from '../../api/api';
import type { ServiceQualification } from '../../data/types';
import { TODAY } from '../../data/seed';
import { useApi } from '../../lib/hooks';
import { date, money } from '../../lib/format';
import { Button, Card, ErrorState, Field, inputCls, LinkButton, Loading, PageHeader, Select, SimNote, Stat, StatusBadge, Stepper, useAction } from '../../components/ui';

const STEPS = ['Customer / unit', 'Address & availability', 'Plan & add-ons', 'Billing', 'Installation', 'Review & submit'];

function nextDays(n: number) {
  const out: string[] = [];
  const d = new Date(TODAY + 'T00:00:00Z');
  while (out.length < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function NewConnection() {
  const user = currentUser();
  const [params] = useSearchParams();
  const residentUnit = user.scopes.find((s) => s.kind === 'unit')?.ref;
  const canProps = can('property.read') && !residentUnit;
  const canAcc = can('account.read') && user.roleId !== 'MDU_PM';
  const [kind, setKind] = useState<'unit' | 'business'>(params.get('unit') || residentUnit || (canProps && !canAcc) ? 'unit' : 'business');
  const [unitId, setUnitId] = useState(params.get('unit') ?? residentUnit ?? '');
  const [pid, setPid] = useState(params.get('unit')?.split('-').slice(0, 2).join('-') ?? '');
  const [accountId, setAccountId] = useState(params.get('account') ?? '');
  const [address, setAddress] = useState(params.get('address') ?? '');
  const [qual, setQual] = useState<ServiceQualification | null>(null);
  const [offeringId, setOfferingId] = useState('');
  const [addOns, setAddOns] = useState<string[]>([]);
  const [billing, setBilling] = useState<string>('');
  const [slot, setSlot] = useState({ date: nextDays(1)[0], window: '09:00–12:00' });
  const [terms, setTerms] = useState(false);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<{ requestId: string; orderId: string; serviceId: string } | null>(null);
  const { run, busy } = useAction();

  const props = useApi(() => (canProps ? listProperties() : Promise.resolve([])));
  const units = useApi(() => (pid && canProps ? listUnits(pid) : Promise.resolve([])), [pid]);
  const unit = useApi(() => (unitId ? getUnit(unitId) : Promise.resolve(null)), [unitId]);
  const accounts = useApi(() => (canAcc ? listAccounts() : Promise.resolve([])));
  const bills = useApi(() => listBillingAccounts({ includeResidents: true }).catch(() => []));

  useEffect(() => {
    if (kind === 'unit' && unit.data) setAddress(`${unit.data.propertyName}, ${unit.data.number}`);
  }, [unit.data, kind]);
  useEffect(() => {
    setQual(null);
  }, [unitId, accountId, kind]);

  if (!can('service.order')) return <ErrorState error={Object.assign(new Error('Your role cannot place orders.'), { name: 'AuthError' })} />;

  const eligible = offerings().filter((o) => qual?.eligibleOfferingIds.includes(o.id));
  const offering = eligible.find((o) => o.id === offeringId);
  const addOnTotal = (offering?.addOns ?? []).filter((a) => addOns.includes(a.id)).reduce((a, x) => a + x.mrc, 0);
  const billingOptions: { value: string; label: string }[] =
    kind === 'unit'
      ? [
          ...(bills.data ?? []).filter((b) => (b.payerRef.kind === 'property' && b.payerRef.id === unit.data?.propertyId) || (b.payerRef.kind === 'customer' && b.payerRef.id === unit.data?.occupant?.customerId)).map((b) => ({ value: b.id, label: `${b.name} (${b.type})` })),
          ...(unit.data?.occupant && !(bills.data ?? []).some((b) => b.payerRef.kind === 'customer' && b.payerRef.id === unit.data?.occupant?.customerId) ? [{ value: 'new-resident', label: `New resident billing account for ${unit.data.occupant.name}` }] : []),
        ]
      : (bills.data ?? []).filter((b) => b.type !== 'Resident').map((b) => ({ value: b.id, label: `${b.name} (${b.id})` }));

  const valid = [
    kind === 'unit' ? !!unitId : !!accountId,
    qual?.result === 'Service Available',
    !!offering,
    !!billing,
    !!slot.date,
    terms,
  ];

  if (done)
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-3 text-xl font-semibold text-navy">Order submitted</h1>
            <p className="mt-1 text-sm text-slate-600">
              Order <span className="font-mono">{done.orderId}</span> · request <span className="font-mono">{done.requestId}</span> · service <span className="font-mono">{done.serviceId}</span> (Pending Installation)
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Installation: {date(slot.date)}, {slot.window}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <LinkButton to={`/requests/${done.requestId}`} variant="primary">
                Track order
              </LinkButton>
              <LinkButton to={`/services/${done.serviceId}`}>View service</LinkButton>
            </div>
          </div>
        </Card>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New Service Connection" crumbs={[{ label: 'Services', to: '/services' }, { label: 'New connection' }]} />
      <Stepper steps={STEPS} current={step} />
      <Card>
        {step === 0 && (
          <div className="space-y-4">
            {!residentUnit && canProps && canAcc && (
              <div className="flex rounded-full border border-line-200 bg-white p-1 sm:w-fit">
                {(['business', 'unit'] as const).map((k) => (
                  <button key={k} onClick={() => setKind(k)} className={clsx('flex-1 rounded-full px-4 py-1.5 text-sm font-medium', kind === k ? 'bg-brand text-white' : 'text-ink-600')}>
                    {k === 'business' ? 'Business account' : 'MDU unit'}
                  </button>
                ))}
              </div>
            )}
            {kind === 'business' ? (
              <Field label="Business account" required>
                <Select label="Business account" value={accountId} onChange={(v) => (setAccountId(v), setAddress(accounts.data?.find((a) => a.id === v)?.serviceAddress ?? ''))} options={[{ value: '', label: 'Select…' }, ...(accounts.data ?? []).filter((a) => a.status === 'Active').map((a) => ({ value: a.id, label: `${a.name} (${a.type})` }))]} />
              </Field>
            ) : residentUnit ? (
              <p className="text-sm">Ordering for your unit: <b>{unit.data?.propertyName} {unit.data?.number}</b></p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Property" required>
                  <Select label="Property" value={pid} onChange={(v) => (setPid(v), setUnitId(''))} options={[{ value: '', label: 'Select…' }, ...(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))]} />
                </Field>
                <Field label="Unit" required hint="Units already connected are not listed">
                  <Select label="Unit" value={unitId} onChange={setUnitId} options={[{ value: '', label: 'Select…' }, ...(units.data ?? []).filter((u) => u.connectivity === 'Ready for Service' || u.connectivity === 'Network Not Ready' || u.id === unitId).map((u) => ({ value: u.id, label: `${u.number} · ${u.connectivity} · ${u.occupancy}` }))]} />
                </Field>
              </div>
            )}
            {kind === 'unit' && unit.data && (
              <div className="flex flex-wrap gap-3 rounded bg-surface-50 p-3 text-sm">
                <span>
                  Connectivity: <StatusBadge status={unit.data.connectivity} />
                </span>
                <span>
                  Occupancy: <StatusBadge status={unit.data.occupancy} />
                </span>
                <span>Occupant: {unit.data.occupant?.name ?? 'none'}</span>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Service address" required>
              <input className={inputCls} value={address} disabled={kind === 'unit'} onChange={(e) => (setAddress(e.target.value), setQual(null))} />
            </Field>
            <Button
              onClick={async () => setQual((await run(() => checkAvailability(kind === 'unit' ? { kind: 'unit', unitId } : { kind: 'address', address, accountId }))) ?? null)}
              loading={busy}
              disabled={address.trim().length < 8}
            >
              <Radar className="h-4 w-4" /> Check service availability
            </Button>
            {qual && (
              <div className={clsx('rounded-md border p-3 text-sm', qual.result === 'Service Available' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50')}>
                <StatusBadge status={qual.result} />
                <p className="mt-1 text-slate-700">{qual.reason}</p>
                {qual.result !== 'Service Available' && <p className="mt-1 font-medium text-red-800">You cannot continue to activation. Raise a feasibility request or choose another location.</p>}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {eligible.map((o) => (
              <label key={o.id} className={clsx('flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm', offeringId === o.id ? 'border-crimson bg-crimson-50' : 'border-line-200')}>
                <input type="radio" checked={offeringId === o.id} onChange={() => (setOfferingId(o.id), setAddOns([]))} />
                <span className="flex-1">
                  <span className="font-medium text-navy">{o.name}</span>
                  <span className="block text-xs text-slate-500">
                    {o.speed ?? o.category} · {o.contractMonths}-month term
                  </span>
                </span>
                <span className="text-right font-semibold">
                  {money(o.mrc)}/mo
                  <span className="block text-xs font-normal text-slate-500">{money(o.nrc)} one-time</span>
                </span>
              </label>
            ))}
            {offering?.addOns && (
              <div>
                <p className="mb-1 text-sm font-semibold text-navy">Add-ons</p>
                <div className="flex flex-wrap gap-2">
                  {offering.addOns.map((a) => (
                    <label key={a.id} className={clsx('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm', addOns.includes(a.id) ? 'border-crimson bg-crimson-50' : 'border-line-200')}>
                      <input type="checkbox" checked={addOns.includes(a.id)} onChange={(e) => setAddOns(e.target.checked ? [...addOns, a.id] : addOns.filter((x) => x !== a.id))} />
                      {a.name} (+{money(a.mrc)})
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Field label="Billing account" required hint={kind === 'unit' ? 'Bill the property (master/hybrid) or the resident directly. Service location does not decide who pays.' : 'Any billing account in your scope'}>
              {bills.data ? <Select label="Billing account" value={billing} onChange={setBilling} options={[{ value: '', label: 'Select…' }, ...billingOptions]} /> : <Loading />}
            </Field>
            {kind === 'unit' && !unit.data?.occupant && <p className="text-xs text-amber-700">This unit has no occupant, so only property billing is possible.</p>}
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-navy">Installation date</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {nextDays(8).map((d) => (
                <button key={d} onClick={() => setSlot({ ...slot, date: d })} className={clsx('rounded-md border px-3 py-2 text-sm', slot.date === d ? 'border-transparent bg-brand text-white' : 'border-line-200 hover:border-crimson')}>
                  {new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })}
                </button>
              ))}
            </div>
            <p className="mb-2 text-sm font-semibold text-navy">Time window</p>
            <div className="flex flex-wrap gap-2">
              {['09:00–12:00', '12:00–15:00', '15:00–18:00'].map((w) => (
                <button key={w} onClick={() => setSlot({ ...slot, window: w })} className={clsx('rounded-md border px-3 py-2 text-sm', slot.window === w ? 'border-transparent bg-brand text-white' : 'border-line-200 hover:border-crimson')}>
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && offering && (
          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Stat label="For">{kind === 'unit' ? `${unit.data?.propertyName} ${unit.data?.number}` : accounts.data?.find((a) => a.id === accountId)?.name}</Stat>
              <Stat label="Address">{address}</Stat>
              <Stat label="Qualification">
                <StatusBadge status={qual!.result} /> <span className="font-mono text-[11px]">{qual!.id}</span>
              </Stat>
              <Stat label="Plan">{offering.name}</Stat>
              <Stat label="Add-ons">{addOns.length ? offering.addOns!.filter((a) => addOns.includes(a.id)).map((a) => a.name).join(', ') : 'None'}</Stat>
              <Stat label="Billing">{billingOptions.find((b) => b.value === billing)?.label}</Stat>
              <Stat label="Installation">
                {date(slot.date)}, {slot.window}
              </Stat>
              <Stat label="Contract term">{offering.contractMonths} months</Stat>
            </dl>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-line-100">
                  <td className="py-1.5">Monthly recurring ({offering.name}{addOns.length ? ' + add-ons' : ''})</td>
                  <td className="py-1.5 text-right font-semibold">{money(offering.mrc + addOnTotal)}</td>
                </tr>
                <tr className="border-b border-line-100">
                  <td className="py-1.5">One-time installation</td>
                  <td className="py-1.5 text-right font-semibold">{money(offering.nrc)}</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-xs text-slate-500">Taxes (GST 18%) applied on invoice</td>
                  <td />
                </tr>
              </tbody>
            </table>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1" />I accept the charges above, the {offering.contractMonths}-month minimum term and the operator’s service terms.
            </label>
            <SimNote>Submits a TMF622 product order and schedules installation (simulated). The service stays Pending Installation until fulfilment completes.</SimNote>
          </div>
        )}

        <div className="mt-6 flex justify-between border-t border-line-100 pt-4">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button disabled={!valid[step]} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <Button
              variant="cta"
              loading={busy}
              disabled={!terms}
              onClick={async () => {
                const r = await run(() =>
                  submitNewConnection({
                    qualificationId: qual!.id,
                    unitId: kind === 'unit' ? unitId : undefined,
                    businessAccountId: kind === 'business' ? accountId : undefined,
                    address,
                    offeringId,
                    addOns,
                    billing: billing === 'new-resident' ? { mode: 'new-resident' } : { mode: 'existing', billingId: billing },
                    appointment: slot,
                    acceptedTerms: terms,
                  }),
                );
                if (r) setDone(r);
              }}
            >
              Submit order
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
