import { useState } from 'react';
import clsx from 'clsx';
import { Radar } from 'lucide-react';
import { can, checkAvailability, currentUser, listAccounts, listProperties, listUnits, offerings } from '../../api/api';
import type { ServiceQualification } from '../../data/types';
import { useApi } from '../../lib/hooks';
import { money } from '../../lib/format';
import { Button, Card, Field, inputCls, LinkButton, PageHeader, Select, SimNote, StatusBadge, useAction } from '../../components/ui';

export function Availability() {
  const user = currentUser();
  const hasProps = can('property.read') && user.roleId !== 'RESIDENT';
  const hasAcc = can('account.read') && user.roleId !== 'MDU_PM';
  const [mode, setMode] = useState<'unit' | 'address'>(hasProps && !hasAcc ? 'unit' : 'address');
  const props = useApi(() => (hasProps ? listProperties() : Promise.resolve([])));
  const accounts = useApi(() => (hasAcc ? listAccounts() : Promise.resolve([])));
  const [pid, setPid] = useState('');
  const units = useApi(() => (pid ? listUnits(pid) : Promise.resolve([])), [pid]);
  const [unitId, setUnitId] = useState('');
  const [acc, setAcc] = useState('');
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<ServiceQualification | null>(null);
  const { run, busy } = useAction();
  const residentUnit = user.scopes.find((s) => s.kind === 'unit')?.ref;

  const check = async () => {
    const target = mode === 'unit' ? { kind: 'unit' as const, unitId: residentUnit ?? unitId } : { kind: 'address' as const, address, accountId: acc || undefined };
    setResult((await run(() => checkAvailability(target))) ?? null);
  };
  const eligible = offerings().filter((o) => result?.eligibleOfferingIds.includes(o.id));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Service Availability" subtitle="Qualify a unit or business address before ordering." crumbs={[{ label: 'Services', to: '/services' }, { label: 'Availability' }]} />
      <Card>
        {!residentUnit && (
          <div className="mb-4 flex rounded-full border border-line-200 bg-white p-1 sm:w-fit">
            {hasProps && (
              <button onClick={() => setMode('unit')} className={clsx('flex-1 rounded-full px-4 py-1.5 text-sm font-medium', mode === 'unit' ? 'bg-brand text-white' : 'text-ink-600')}>
                MDU unit
              </button>
            )}
            {hasAcc && (
              <button onClick={() => setMode('address')} className={clsx('flex-1 rounded-full px-4 py-1.5 text-sm font-medium', mode === 'address' ? 'bg-brand text-white' : 'text-ink-600')}>
                Business address
              </button>
            )}
          </div>
        )}
        {residentUnit ? (
          <p className="mb-3 text-sm text-slate-600">Checking availability for your unit.</p>
        ) : mode === 'unit' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Property">
              <Select label="Property" value={pid} onChange={(v) => (setPid(v), setUnitId(''))} options={[{ value: '', label: 'Select property…' }, ...(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))]} />
            </Field>
            <Field label="Unit">
              <Select label="Unit" value={unitId} onChange={setUnitId} options={[{ value: '', label: pid ? 'Select unit…' : 'Choose a property first' }, ...(units.data ?? []).map((u) => ({ value: u.id, label: `${u.number} · ${u.connectivity} · ${u.occupancy}` }))]} />
            </Field>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[240px_1fr]">
            <Field label="Business account">
              <Select label="Account" value={acc} onChange={(v) => (setAcc(v), setAddress(accounts.data?.find((a) => a.id === v)?.serviceAddress ?? address))} options={[{ value: '', label: 'Select…' }, ...(accounts.data ?? []).filter((a) => a.status === 'Active').map((a) => ({ value: a.id, label: a.name }))]} />
            </Field>
            <Field label="Service address" hint="Try different addresses — some are on-net, near-net or off-net">
              <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Building, street, city, PIN" />
            </Field>
          </div>
        )}
        <Button className="mt-4" onClick={check} loading={busy} disabled={!residentUnit && (mode === 'unit' ? !unitId : address.trim().length < 8)}>
          <Radar className="h-4 w-4" /> Check availability
        </Button>
      </Card>
      {result && (
        <Card className="mt-4" title={<span className="flex items-center gap-2 text-sm font-semibold text-navy">Result <StatusBadge status={result.result} /></span>}>
          <p className="text-sm text-slate-700">{result.reason}</p>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            {result.id} · {result.target.ref}
          </p>
          {eligible.length > 0 ? (
            <>
              <h3 className="mb-2 mt-4 text-sm font-semibold text-navy">Eligible products</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {eligible.map((o) => (
                  <div key={o.id} className="rounded-md border border-line-200 p-3 text-sm">
                    <p className="font-medium text-navy">{o.name}</p>
                    <p className="text-xs text-slate-500">
                      {o.speed ?? o.category} · {o.contractMonths}-month term
                    </p>
                    <p className="mt-1 font-semibold">
                      {money(o.mrc)}/mo <span className="text-xs font-normal text-slate-500">+ {money(o.nrc)} one-time</span>
                    </p>
                  </div>
                ))}
              </div>
              {can('service.order') && (
                <LinkButton className="mt-4" variant="primary" to={result.target.kind === 'unit' ? `/services/new?unit=${result.target.ref}` : `/services/new?account=${acc}&address=${encodeURIComponent(address)}`}>
                  Continue to order
                </LinkButton>
              )}
            </>
          ) : (
            <p className="mt-3 rounded bg-surface-100 p-2 text-sm text-ink-700">Ordering is not permitted until qualification passes. {result.result === 'Additional Network Work Required' && 'Raise a Property Connectivity Issue or feasibility request to schedule network build.'}</p>
          )}
        </Card>
      )}
      <div className="mt-4">
        <SimNote />
      </div>
    </div>
  );
}
