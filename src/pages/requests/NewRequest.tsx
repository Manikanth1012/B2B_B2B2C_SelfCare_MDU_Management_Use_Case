import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { can, createRequest, currentUser, listAccounts, listBillingAccounts, listProperties, listServices, listUnits, type NewRequestInput } from '../../api/api';
import type { RequestCategory } from '../../data/types';
import { useApi } from '../../lib/hooks';
import { Button, ErrorState, Field, inputCls, Loading, PageHeader, useAction } from '../../components/ui';

/* Category types and names, mirroring the template's two-level ticket categorisation. */
const CATEGORY_TYPES: Record<string, { kind: 'Service Request' | 'Incident'; categories: RequestCategory[] }> = {
  'Fault / Incident': { kind: 'Incident', categories: ['Network Issue', 'Property Connectivity Issue'] },
  'Service Request': { kind: 'Service Request', categories: ['New Connection', 'Plan Change', 'Service Suspension', 'Bulk Activation'] },
  'Billing': { kind: 'Service Request', categories: ['Billing Query'] },
  'Account': { kind: 'Service Request', categories: ['Account Modification'] },
};

async function load() {
  const [accounts, properties, services, billing] = await Promise.all([
    can('account.read') ? listAccounts().catch(() => []) : Promise.resolve([]),
    can('property.read') ? listProperties().catch(() => []) : Promise.resolve([]),
    can('service.read') ? listServices().catch(() => []) : Promise.resolve([]),
    can('billing.read') ? listBillingAccounts({ includeResidents: true }).catch(() => []) : Promise.resolve([]),
  ]);
  return { accounts, properties, services, billing };
}

const red = 'border-l-[3px] border-l-crimson';

export function NewRequest() {
  const [params] = useSearchParams();
  const user = currentUser();
  const q = useApi(load);
  const residentUnit = user.scopes.find((s) => s.kind === 'unit')?.ref;
  const presetCat = params.get('category') as RequestCategory | null;
  const presetType = presetCat ? Object.entries(CATEGORY_TYPES).find(([, v]) => v.categories.includes(presetCat))?.[0] : undefined;
  const [f, setF] = useState({
    ticketType: params.get('unit') || params.get('property') ? 'Fault / Incident' : '',
    categoryType: presetType ?? '',
    category: (presetCat ?? '') as RequestCategory | '',
    priority: 'Medium' as NewRequestInput['priority'],
    accountId: params.get('account') ?? '',
    propertyId: params.get('property') ?? params.get('unit')?.split('-').slice(0, 2).join('-') ?? (residentUnit ? residentUnit.split('-').slice(0, 2).join('-') : ''),
    unitId: params.get('unit') ?? residentUnit ?? '',
    serviceId: '',
    billingId: '',
    title: '',
    description: '',
    file: '',
  });
  const units = useApi(() => (f.propertyId && !residentUnit && can('property.read') ? listUnits(f.propertyId) : Promise.resolve([])), [f.propertyId]);
  const [touched, setTouched] = useState(false);
  const { run, busy } = useAction();
  const nav = useNavigate();
  const services = useMemo(() => (q.data?.services ?? []).filter((s) => (!f.accountId || s.businessAccountId === f.accountId) && (!f.unitId || s.unitId === f.unitId) && (!f.propertyId || f.unitId || s.propertyId === f.propertyId)), [q.data, f.accountId, f.unitId, f.propertyId]);
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  if (!can('request.create')) return <ErrorState error={Object.assign(new Error('Your role cannot create tickets.'), { name: 'AuthError' })} />;

  const accountNumber = residentUnit ? residentUnit : f.accountId || f.propertyId || f.billingId || '—';
  const errs = {
    categoryType: !f.categoryType && 'Select a category type',
    category: !f.category && 'Select a category name',
    title: f.title.trim().length < 5 && 'Subject must be at least 5 characters',
    description: f.description.trim().length < 10 && 'Describe the issue (10+ characters)',
    link: !f.accountId && !f.propertyId && !f.unitId && !f.billingId && 'Link the ticket to an account, property, unit or billing account',
  };
  const invalid = Object.values(errs).some(Boolean);
  const submit = async () => {
    setTouched(true);
    if (invalid) return;
    const id = await run(
      () =>
        createRequest({
          kind: CATEGORY_TYPES[f.categoryType].kind,
          category: f.category as RequestCategory,
          title: f.title,
          description: f.description,
          priority: f.priority,
          businessAccountId: f.accountId || undefined,
          propertyId: f.propertyId || undefined,
          unitId: f.unitId || undefined,
          serviceId: f.serviceId || undefined,
          billingAccountId: f.billingId || undefined,
          attachments: f.file ? [f.file] : [],
        }),
      (x) => `Ticket ${x} created`,
    );
    if (id) nav(`/requests/${id}`);
  };
  const err = (k: keyof typeof errs) => (touched && errs[k]) || undefined;

  return (
    <div>
      <PageHeader title="Service Center" crumbs={[{ label: 'Service Center', to: '/requests' }, { label: 'Create Ticket' }]} />
      <section className="rounded-card border border-line-100 bg-white/95 px-5 py-6 sm:px-9">
        <h2 className="mb-5 text-lg font-bold text-navy">Create Ticket</h2>
        <div className="grid gap-x-10 gap-y-5 md:grid-cols-3">
          <Field label="Account Number">
            <input className={inputCls} value={accountNumber} disabled />
          </Field>
          {!residentUnit && q.data.accounts.length > 0 && (
            <Field label="Business account">
              <select className={inputCls} value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value, serviceId: '' })}>
                <option value="">— none —</option>
                {q.data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {!residentUnit && q.data.properties.length > 0 && (
            <Field label="Property / unit">
              <div className="flex gap-2">
                <select className={inputCls} value={f.propertyId} onChange={(e) => setF({ ...f, propertyId: e.target.value, unitId: '', serviceId: '' })}>
                  <option value="">— property —</option>
                  {q.data.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select className={inputCls} value={f.unitId} disabled={!f.propertyId} onChange={(e) => setF({ ...f, unitId: e.target.value, serviceId: '' })}>
                  <option value="">Whole property</option>
                  {(units.data ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.number}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          )}
          <Field label="Service Name">
            <select className={inputCls} value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })}>
              <option value="">— not service specific —</option>
              {services.slice(0, 200).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.offeringName} ({s.id})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ticket Type">
            <select className={clsx(inputCls, red)} value={f.ticketType} onChange={(e) => setF({ ...f, ticketType: e.target.value, priority: e.target.value === 'Fault / Incident' ? 'High' : 'Medium' })}>
              <option value="">Ticket Type</option>
              <option>Fault / Incident</option>
              <option>Request</option>
              <option>Query</option>
            </select>
          </Field>
          <Field label="Category Type" error={err('categoryType')}>
            <select className={clsx(inputCls, 'bg-[#E9ECEF]')} value={f.categoryType} onChange={(e) => setF({ ...f, categoryType: e.target.value, category: '' })}>
              <option value="">Category Type</option>
              {Object.keys(CATEGORY_TYPES).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Category Name" error={err('category')}>
            <select className={clsx(inputCls, 'bg-[#E9ECEF]')} value={f.category} disabled={!f.categoryType} onChange={(e) => setF({ ...f, category: e.target.value as RequestCategory })}>
              <option value="">Category Name</option>
              {(CATEGORY_TYPES[f.categoryType]?.categories ?? []).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select className={inputCls} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as NewRequestInput['priority'] })}>
              {['Low', 'Medium', 'High', 'Critical'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          {f.category === 'Billing Query' && q.data.billing.length > 0 && (
            <Field label="Billing account">
              <select className={inputCls} value={f.billingId} onChange={(e) => setF({ ...f, billingId: e.target.value })}>
                <option value="">Select…</option>
                {q.data.billing.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Subject" error={err('title')}>
            <textarea className={clsx(inputCls, red, 'h-24 py-2.5')} placeholder="Subject" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <Field label="Description" error={err('description')}>
            <textarea className={clsx(inputCls, red, 'h-24 py-2.5')} placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <Field label="Attachment (optional)">
            <input type="file" className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-full file:border-0 file:bg-crimson-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-crimson" onChange={(e) => setF({ ...f, file: e.target.files?.[0]?.name ?? '' })} />
          </Field>
        </div>
        {touched && errs.link && <p className="mt-4 text-sm font-semibold text-red-700">{errs.link}</p>}
        <div className="mt-8 flex flex-wrap gap-6">
          <Button variant="secondary" className="min-w-[160px]" onClick={() => nav(-1)}>
            Cancel
          </Button>
          <Button className="min-w-[160px]" loading={busy} onClick={submit}>
            Create
          </Button>
        </div>
      </section>
    </div>
  );
}
