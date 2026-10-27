import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { can, currentUser, registerProperty, type RegisterPropertyInput } from '../../api/api';
import type { BillingModel } from '../../data/types';
import { TODAY } from '../../data/seed';
import { Button, Card, ErrorState, Field, inputCls, LinkButton, PageHeader, Select, SimNote, Stat, Stepper, useAction } from '../../components/ui';

const STEPS = ['Property information', 'Building configuration', 'Connectivity', 'Billing arrangement', 'Review & register'];
const BILLING: { id: BillingModel; desc: string }[] = [
  { id: 'Individual', desc: 'Each resident is billed directly by the operator.' },
  { id: 'Master', desc: 'Property management pays for selected services.' },
  { id: 'Bulk Contract', desc: 'Master contract covering all units at a per-unit rate.' },
  { id: 'Hybrid', desc: 'Shared connectivity to property, subscriptions to residents.' },
];

export function RegisterMdu() {
  const user = currentUser();
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const { run, busy } = useAction();
  const [f, setF] = useState<RegisterPropertyInput>({
    name: '',
    type: 'Apartment',
    managementOrg: user.tenantId === 'TEN-PMH' ? 'Palm Meadows Habitat Services' : 'Evergreen Estate Management',
    address: '',
    city: '',
    contactPhone: '',
    contactEmail: '',
    towers: [
      { name: 'Tower A', floors: 4, unitsPerFloor: 4 },
      { name: 'Tower B', floors: 4, unitsPerFloor: 4 },
    ],
    technology: 'FTTH',
    readiness: 'Survey Pending',
    capacityPorts: 64,
    olts: [{ name: 'OLT-1', ports: 64, location: '' }],
    plannedActivation: '2026-12-01',
    billingModel: 'Individual',
  });
  const setOlt = (i: number, patch: Partial<RegisterPropertyInput['olts'][number]>) => setF({ ...f, olts: f.olts.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const totalUnits = f.towers.reduce((a, t) => a + t.floors * t.unitsPerFloor, 0);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!f.name.trim()) e.name = 'Property name is required';
      if (!f.address.trim()) e.address = 'Address is required';
      if (!f.city.trim()) e.city = 'City is required';
      if (!/^\S+@\S+\.\S+$/.test(f.contactEmail)) e.contactEmail = 'Valid email required';
      if (f.lat !== undefined && (f.lat < -90 || f.lat > 90)) e.lat = 'Latitude must be between -90 and 90';
      if (f.lng !== undefined && (f.lng < -180 || f.lng > 180)) e.lng = 'Longitude must be between -180 and 180';
    }
    if (step === 1) {
      if (!f.towers.length) e.towers = 'Add at least one building';
      const names = f.towers.map((t) => t.name.trim().toLowerCase());
      if (names.some((n) => !n)) e.towers = 'Every building needs a name';
      else if (new Set(names).size !== names.length) e.towers = 'Building names must be unique';
      if (f.towers.some((t) => t.floors < 1 || t.floors > 80 || t.unitsPerFloor < 1 || t.unitsPerFloor > 40)) e.towers = 'Floors 1–80 and units per floor 1–40';
    }
    if (step === 2) {
      if (f.capacityPorts < 1) e.capacityPorts = 'Capacity must be at least 1';
      if (f.plannedActivation <= TODAY) e.plannedActivation = 'Planned activation must be in the future';
    }
    return e;
  }, [f, step]);

  if (!can('property.create')) return <ErrorState error={Object.assign(new Error('Your role cannot register properties.'), { name: 'AuthError' })} />;

  const next = () => {
    setTouched(true);
    if (!Object.keys(errors).length) {
      setStep((s) => s + 1);
      setTouched(false);
    }
  };
  const err = (k: string) => (touched ? errors[k] : undefined);
  const setTower = (i: number, patch: Partial<RegisterPropertyInput['towers'][number]>) => setF({ ...f, towers: f.towers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  if (created)
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-3 text-xl font-semibold text-navy">Property registered</h1>
            <p className="mt-1 text-sm text-slate-600">
              {f.name} · <span className="font-mono">{created}</span> · {f.towers.length} buildings · {totalUnits} units created with occupancy “Unknown”.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <LinkButton to={`/mdu/${created}`} variant="primary">
                View property
              </LinkButton>
              <LinkButton to={`/mdu/units?property=${created}`}>Open unit grid</LinkButton>
              <LinkButton to={`/mdu/import?property=${created}`}>Import occupants (CSV)</LinkButton>
            </div>
          </div>
        </Card>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Register New MDU" crumbs={[{ label: 'MDU Portfolio', to: '/mdu' }, { label: 'Register' }]} />
      <Stepper steps={STEPS} current={step} />
      <Card>
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Property name" required error={err('name')}>
              <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Lakeview Enclave" />
            </Field>
            <Field label="Property type">
              <Select label="Property type" value={f.type} onChange={(v) => setF({ ...f, type: v as RegisterPropertyInput['type'] })} options={['Apartment', 'Gated Community', 'Condominium', 'Mixed Use']} />
            </Field>
            <Field label="Owner / management organisation">
              <input className={inputCls} value={f.managementOrg} onChange={(e) => setF({ ...f, managementOrg: e.target.value })} />
            </Field>
            <Field label="Address" required error={err('address')}>
              <input className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
            </Field>
            <Field label="City" required error={err('city')}>
              <input className={inputCls} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Latitude (optional)" error={err('lat')}>
                <input type="number" step="any" className={inputCls} value={f.lat ?? ''} onChange={(e) => setF({ ...f, lat: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </Field>
              <Field label="Longitude (optional)" error={err('lng')}>
                <input type="number" step="any" className={inputCls} value={f.lng ?? ''} onChange={(e) => setF({ ...f, lng: e.target.value === '' ? undefined : Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Contact phone">
              <input className={inputCls} value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} />
            </Field>
            <Field label="Contact email" required error={err('contactEmail')}>
              <input className={inputCls} value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="hidden grid-cols-[1fr_120px_140px_90px_40px] gap-2 px-1 pb-1 text-xs font-semibold text-slate-500 sm:grid">
              <span>Building / tower name</span>
              <span>Floors</span>
              <span>Units per floor</span>
              <span>Units</span>
              <span />
            </div>
            {f.towers.map((t, i) => (
              <div key={i} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_120px_140px_90px_40px]">
                <input aria-label="Tower name" className={clsx(inputCls, 'col-span-2 sm:col-span-1')} value={t.name} onChange={(e) => setTower(i, { name: e.target.value })} />
                <input aria-label="Floors" type="number" min={1} max={80} className={inputCls} value={t.floors} onChange={(e) => setTower(i, { floors: Number(e.target.value) })} />
                <input aria-label="Units per floor" type="number" min={1} max={40} className={inputCls} value={t.unitsPerFloor} onChange={(e) => setTower(i, { unitsPerFloor: Number(e.target.value) })} />
                <span className="flex items-center text-sm font-semibold text-navy">{t.floors * t.unitsPerFloor}</span>
                <button aria-label={`Remove ${t.name}`} className="rounded p-2 text-red-600 hover:bg-red-50" onClick={() => setF({ ...f, towers: f.towers.filter((_, j) => j !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setF({ ...f, towers: [...f.towers, { name: `Tower ${String.fromCharCode(65 + f.towers.length)}`, floors: 4, unitsPerFloor: 4 }] })}>
              <Plus className="h-4 w-4" /> Add building
            </Button>
            {err('towers') && <p className="mt-2 text-xs font-semibold text-red-700">{errors.towers}</p>}
            <p className="mt-4 rounded bg-surface-100 p-2 text-sm text-ink-700">
              Units will be generated as <span className="font-mono">{'<Tower>-<Floor><Unit>'}</span>, e.g. <span className="font-mono">A-101</span>. Total: <b>{totalUnits}</b> units.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Broadband technology">
              <Select label="Technology" value={f.technology} onChange={(v) => setF({ ...f, technology: v as RegisterPropertyInput['technology'] })} options={['FTTH', 'FTTB', 'Ethernet']} />
            </Field>
            <Field label="Network readiness" hint="‘Ready’ marks every generated unit as ready for service">
              <Select label="Readiness" value={f.readiness} onChange={(v) => setF({ ...f, readiness: v as RegisterPropertyInput['readiness'] })} options={['Ready', 'Partially Ready', 'Survey Pending', 'Not Ready']} />
            </Field>
            <Field label="Total access ports" hint={`Calculated from OLT configuration below: ${f.olts.reduce((a, o) => a + o.ports, 0)} ports total${f.olts.reduce((a, o) => a + o.ports, 0) < totalUnits ? ` — below unit count (${totalUnits}); expansion needed for full take-up` : ''}`}>
              <input type="number" className={inputCls} value={f.olts.reduce((a, o) => a + o.ports, 0) || f.capacityPorts} disabled />
            </Field>
            <Field label="Planned activation date" error={err('plannedActivation')}>
              <input type="date" className={inputCls} value={f.plannedActivation} onChange={(e) => setF({ ...f, plannedActivation: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <p className="mb-1 text-sm font-semibold text-navy">OLTs (Optical Line Terminals)</p>
              <div className="hidden grid-cols-[1fr_100px_1fr_36px] gap-2 px-1 pb-1 text-xs font-semibold text-slate-500 sm:grid">
                <span>OLT name / identifier</span>
                <span>Ports</span>
                <span>Location / riser</span>
                <span />
              </div>
              {f.olts.map((o, i) => (
                <div key={i} className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_100px_1fr_36px]">
                  <input aria-label="OLT name" className={inputCls} value={o.name} onChange={(e) => setOlt(i, { name: e.target.value })} placeholder="e.g. OLT-A" />
                  <input aria-label="Ports" type="number" min={1} max={1024} className={inputCls} value={o.ports} onChange={(e) => setOlt(i, { ports: Number(e.target.value) })} />
                  <input aria-label="Location" className={clsx(inputCls, 'col-span-2 sm:col-span-1')} value={o.location} onChange={(e) => setOlt(i, { location: e.target.value })} placeholder="e.g. Tower A, Ground Floor" />
                  <button aria-label="Remove OLT" className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-30" disabled={f.olts.length === 1} onClick={() => setF({ ...f, olts: f.olts.filter((_, j) => j !== i) })}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => setF({ ...f, olts: [...f.olts, { name: `OLT-${f.olts.length + 1}`, ports: 64, location: '' }] })}>
                <Plus className="h-4 w-4" /> Add OLT
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {BILLING.map((b) => (
              <button key={b.id} onClick={() => setF({ ...f, billingModel: b.id })} className={clsx('rounded-lg border p-3 text-left text-sm', f.billingModel === b.id ? 'border-crimson bg-crimson-50 ring-1 ring-crimson' : 'border-line-200 hover:border-crimson')}>
                <p className="font-semibold text-navy">{b.id === 'Master' ? 'Property management billing' : b.id === 'Individual' ? 'Individual resident billing' : b.id === 'Bulk Contract' ? 'Bulk / master contract billing' : 'Hybrid billing'}</p>
                <p className="text-xs text-slate-500">{b.desc}</p>
              </button>
            ))}
            {f.billingModel !== 'Individual' && <p className="text-xs text-slate-600 sm:col-span-2">A property billing account will be created and linked to this property.</p>}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Stat label="Property">
                {f.name} ({f.type})
              </Stat>
              <Stat label="Address">
                {f.address}, {f.city}
              </Stat>
              <Stat label="Management">{f.managementOrg}</Stat>
              <Stat label="Buildings">{f.towers.map((t) => `${t.name} (${t.floors}×${t.unitsPerFloor})`).join(', ')}</Stat>
              <Stat label="Total units">{totalUnits}</Stat>
              <Stat label="Connectivity">
                {f.technology} · {f.readiness} · {f.capacityPorts} ports
              </Stat>
              <Stat label="OLTs">
                {f.olts.map((o, i) => {
                  const served = f.towers.filter((_, ti) => ti % f.olts.length === i).map((t) => t.name).join(', ');
                  return `${o.name}: ${o.ports}p${o.location ? ' @ ' + o.location : ''}${served ? ' → ' + served : ''}`;
                }).join(' · ')}
              </Stat>
              <Stat label="Planned activation">{f.plannedActivation}</Stat>
              <Stat label="Billing">{f.billingModel}</Stat>
            </dl>
            <SimNote>Creates the property and its building/floor/unit location structure.</SimNote>
          </div>
        )}

        <div className="mt-6 flex justify-between border-t border-line-100 pt-4">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button
              variant="cta"
              loading={busy}
              onClick={async () => {
                const id = await run(() => registerProperty(f), 'Property registered');
                if (id) setCreated(id);
              }}
            >
              Register property
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
