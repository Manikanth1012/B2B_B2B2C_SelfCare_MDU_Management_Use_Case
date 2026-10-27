import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { CheckCircle2 } from 'lucide-react';
import { can, CHILD_RULES, createChildAccount, getSettings, listAccounts, listBillingAccounts, listUsers, type CreateChildInput } from '../../api/api';
import type { BusinessAccountType } from '../../data/types';
import { useApi } from '../../lib/hooks';
import { Button, Card, ErrorState, Field, inputCls, LinkButton, Loading, PageHeader, Select, SimNote, Stat, Stepper, useAction } from '../../components/ui';

const STEPS = ['Parent account', 'Account type', 'Account details', 'Relationships', 'Review & submit'];
const TYPES: { id: BusinessAccountType | 'Billing'; label: string; desc: string }[] = [
  { id: 'Subsidiary', label: 'Business / Subsidiary', desc: 'Separate legal entity owned by the parent.' },
  { id: 'Department', label: 'Department', desc: 'Internal cost-centre or function.' },
  { id: 'Branch', label: 'Branch', desc: 'Physical office or site of the parent.' },
  { id: 'Service', label: 'Service Account', desc: 'Groups services delivered at a location.' },
  { id: 'Billing', label: 'Billing Account', desc: 'Pays for charges; linked, not an org child.' },
];

async function load() {
  const [accounts, billing, users] = await Promise.all([listAccounts(), listBillingAccounts().catch(() => []), can('user.manage') ? listUsers() : Promise.resolve([])]);
  return { accounts, billing, users };
}

export function CreateChild() {
  const [params] = useSearchParams();
  const q = useApi(load);
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const [f, setF] = useState<CreateChildInput>({
    parentId: params.get('parent') ?? '',
    type: 'Branch',
    name: '',
    registrationNo: '',
    industry: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    serviceAddress: '',
    billingAddress: '',
    billing: { mode: 'inherit' },
    admin: { mode: 'none', inherit: true },
  });
  const [done, setDone] = useState<{ accountId?: string; billingId?: string; pendingApproval: boolean } | null>(null);
  const { run, busy } = useAction();

  const parent = q.data?.accounts.find((a) => a.id === f.parentId);
  const parentBilling = q.data?.billing.filter((b) => b.payerRef.kind === 'business' && (b.payerRef.id === f.parentId || q.data!.accounts.find((a) => a.id === f.parentId)?.parentId === b.payerRef.id)) ?? [];
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Account name is required';
    else if (q.data?.accounts.some((a) => a.name.toLowerCase() === f.name.trim().toLowerCase())) e.name = 'An account with this name already exists';
    if (f.type !== 'Billing') {
      if (!f.contactName.trim()) e.contactName = 'Contact name is required';
      if (!/^\S+@\S+\.\S+$/.test(f.contactEmail)) e.contactEmail = 'Valid email required';
      if (f.contactPhone && !/^\+?[\d\s-]{8,}$/.test(f.contactPhone)) e.contactPhone = 'Enter a valid phone number';
      if (f.type === 'Subsidiary' && !f.registrationNo?.trim()) e.registrationNo = 'Registration number is required for a legal entity';
      if ((f.type === 'Branch' || f.type === 'Service') && !f.serviceAddress?.trim()) e.serviceAddress = 'Service address is required for a site';
    }
    return e;
  }, [f, q.data]);

  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  if (!can('account.create')) return <ErrorState error={Object.assign(new Error('Your role cannot create child accounts.'), { name: 'AuthError' })} />;

  const eligibleParents = q.data.accounts.filter((a) => a.status === 'Active');
  const allowed = parent ? CHILD_RULES[parent.type] : [];
  const canNext = [!!parent, allowed.includes(f.type), Object.keys(errors).length === 0, f.admin.mode !== 'invite' || /^\S+@\S+\.\S+$/.test(f.admin.email ?? ''), true][step];

  const next = () => {
    setTouched(true);
    if (canNext) {
      setStep((s) => s + 1);
      setTouched(false);
    }
  };
  const submit = async () => {
    const r = await run(() => createChildAccount(f));
    if (r) setDone(r);
  };

  if (done)
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-3 text-xl font-bold text-navy">{done.pendingApproval ? 'Account submitted for approval' : f.type === 'Billing' ? 'Billing account created' : 'Child account created'}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {f.name} {done.accountId && <span className="font-mono">({done.accountId})</span>} {done.billingId && <span className="font-mono">billing {done.billingId}</span>} under {parent?.name}.
            </p>
            {done.pendingApproval && <p className="mt-2 text-sm text-amber-700">Status is Pending Approval until a super administrator approves it.</p>}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {done.accountId && (
                <LinkButton to={`/accounts/${done.accountId}`} variant="primary">
                  View account
                </LinkButton>
              )}
              <LinkButton to={`/accounts/hierarchy?focus=${done.accountId ?? f.parentId}`}>View in hierarchy</LinkButton>
              {done.billingId && <LinkButton to={`/billing/hierarchy?focus=${done.billingId}`}>View billing hierarchy</LinkButton>}
            </div>
          </div>
        </Card>
      </div>
    );

  const err = (k: string) => (touched ? errors[k] : undefined);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Create Child Account" crumbs={[{ label: 'Business Accounts', to: '/accounts' }, { label: 'Create child account' }]} />
      <Stepper steps={STEPS} current={step} />
      <Card>
        {step === 0 && (
          <div>
            <p className="mb-3 text-sm text-slate-600">Only active accounts within your authorised scope are listed.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {eligibleParents.map((a) => (
                <button key={a.id} onClick={() => setF({ ...f, parentId: a.id, type: CHILD_RULES[a.type].includes(f.type) ? f.type : CHILD_RULES[a.type][0] })} className={clsx('rounded-lg border p-3 text-left text-sm transition', f.parentId === a.id ? 'border-crimson bg-crimson-50 ring-1 ring-crimson' : 'border-slate-200 hover:border-crimson')}>
                  <p className="font-semibold text-navy">{a.name}</p>
                  <p className="text-xs text-slate-500">
                    {a.type} · {a.id} {a.parentName && `· under ${a.parentName}`}
                  </p>
                </button>
              ))}
            </div>
            {touched && !parent && <p className="mt-2 text-xs font-semibold text-red-700">Select a parent account.</p>}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {TYPES.map((t) => {
              const ok = allowed.includes(t.id);
              return (
                <button key={t.id} disabled={!ok} onClick={() => setF({ ...f, type: t.id })} className={clsx('rounded-lg border p-3 text-left text-sm transition', !ok && 'cursor-not-allowed opacity-50', f.type === t.id && ok ? 'border-crimson bg-crimson-50 ring-1 ring-crimson' : 'border-slate-200 hover:border-crimson')}>
                  <p className="font-semibold text-navy">{t.label}</p>
                  <p className="text-xs text-slate-500">{ok ? t.desc : `Not allowed under a ${parent?.type} account`}</p>
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={f.type === 'Billing' ? 'Billing account name' : 'Account name'} required error={err('name')}>
              <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={f.type === 'Billing' ? 'e.g. Pune Office Billing' : 'e.g. 6D Pune'} />
            </Field>
            {f.type !== 'Billing' && (
              <>
                <Field label="Registration number" required={f.type === 'Subsidiary'} error={err('registrationNo')} hint="Company identification number, where applicable">
                  <input className={inputCls} value={f.registrationNo} onChange={(e) => setF({ ...f, registrationNo: e.target.value })} />
                </Field>
                <Field label="Industry / business type">
                  <input className={inputCls} value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} placeholder={parent?.industry} />
                </Field>
                <Field label="Primary contact name" required error={err('contactName')}>
                  <input className={inputCls} value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} />
                </Field>
                <Field label="Contact email" required error={err('contactEmail')}>
                  <input type="email" className={inputCls} value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} />
                </Field>
                <Field label="Contact phone" error={err('contactPhone')}>
                  <input className={inputCls} value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} placeholder="+91 …" />
                </Field>
                <Field label="Service address" required={f.type === 'Branch' || f.type === 'Service'} error={err('serviceAddress')}>
                  <input className={inputCls} value={f.serviceAddress} onChange={(e) => setF({ ...f, serviceAddress: e.target.value })} />
                </Field>
                <Field label="Billing address" hint="Defaults to the service address">
                  <input className={inputCls} value={f.billingAddress} onChange={(e) => setF({ ...f, billingAddress: e.target.value })} />
                </Field>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Stat label="Parent account">{parent?.name}</Stat>
              <Stat label="Relationship">{f.type === 'Billing' ? 'Billing account paid by parent' : 'Organisational ownership (effective today)'}</Stat>
              <Stat label="Service delivery location">{f.serviceAddress || parent?.serviceAddress || '—'}</Stat>
            </dl>
            <div>
              <p className="mb-2 text-sm font-bold text-navy">Billing account association</p>
              {f.type === 'Billing' ? (
                <Field label="Roll up into parent billing account (optional)">
                  <Select label="Parent billing" value={f.billing.parentBillingId ?? ''} onChange={(v) => setF({ ...f, billing: { ...f.billing, parentBillingId: v || undefined } })} options={[{ value: '', label: 'None – standalone' }, ...parentBilling.map((b) => ({ value: b.id, label: `${b.name} (${b.id})` }))]} />
                </Field>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { id: 'inherit', label: 'Bill via parent', desc: 'Services are charged to the parent’s billing account (consolidated).' },
                    { id: 'new', label: 'Create own billing account', desc: 'A new billing account paid by this account, optionally rolling up.' },
                  ].map((o) => (
                    <button key={o.id} onClick={() => setF({ ...f, billing: { ...f.billing, mode: o.id as 'inherit' | 'new' } })} className={clsx('rounded-lg border p-3 text-left text-sm', f.billing.mode === o.id ? 'border-crimson bg-crimson-50 ring-1 ring-crimson' : 'border-slate-200')}>
                      <p className="font-semibold text-navy">{o.label}</p>
                      <p className="text-xs text-slate-500">{o.desc}</p>
                    </button>
                  ))}
                  {f.billing.mode === 'new' && (
                    <Field label="Roll up into">
                      <Select label="Roll up into" value={f.billing.parentBillingId ?? ''} onChange={(v) => setF({ ...f, billing: { ...f.billing, parentBillingId: v || undefined } })} options={[{ value: '', label: 'Standalone' }, ...parentBilling.map((b) => ({ value: b.id, label: `${b.name} (${b.id})` }))]} />
                    </Field>
                  )}
                </div>
              )}
            </div>
            {f.type !== 'Billing' && (
              <div>
                <p className="mb-2 text-sm font-bold text-navy">Administrator assignment</p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(['none', ...(q.data.users.length ? ['existing'] : []), 'invite'] as const).map((m) => (
                    <button key={m} onClick={() => setF({ ...f, admin: { ...f.admin, mode: m as 'none' } })} className={clsx('rounded-full border px-3 py-1 text-sm font-semibold', f.admin.mode === m ? 'border-transparent bg-brand text-white' : 'border-slate-300 text-slate-600')}>
                      {m === 'none' ? 'Assign later' : m === 'existing' ? 'Existing user' : 'Invite new administrator'}
                    </button>
                  ))}
                </div>
                {f.admin.mode === 'existing' && (
                  <Select label="Administrator" value={f.admin.userId ?? ''} onChange={(v) => setF({ ...f, admin: { ...f.admin, userId: v } })} options={[{ value: '', label: 'Select user…' }, ...q.data.users.filter((u) => u.status !== 'Revoked' && u.roleId !== 'RESIDENT').map((u) => ({ value: u.id, label: `${u.name} – ${u.roleName}` }))]} />
                )}
                {f.admin.mode === 'invite' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name">
                      <input className={inputCls} value={f.admin.name ?? ''} onChange={(e) => setF({ ...f, admin: { ...f.admin, name: e.target.value } })} />
                    </Field>
                    <Field label="Email" required error={touched && !/^\S+@\S+\.\S+$/.test(f.admin.email ?? '') ? 'Valid email required' : undefined}>
                      <input className={inputCls} value={f.admin.email ?? ''} onChange={(e) => setF({ ...f, admin: { ...f.admin, email: e.target.value } })} />
                    </Field>
                  </div>
                )}
                {f.admin.mode !== 'none' && (
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.admin.inherit} onChange={(e) => setF({ ...f, admin: { ...f.admin, inherit: e.target.checked } })} /> Inherit to future child accounts of this account
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Stat label="Parent">{parent?.name}</Stat>
              <Stat label="Type">{TYPES.find((t) => t.id === f.type)?.label}</Stat>
              <Stat label="Name">{f.name}</Stat>
              {f.type !== 'Billing' && (
                <>
                  <Stat label="Registration">{f.registrationNo}</Stat>
                  <Stat label="Primary contact">
                    {f.contactName} · {f.contactEmail}
                  </Stat>
                  <Stat label="Service address">{f.serviceAddress}</Stat>
                  <Stat label="Billing">{f.billing.mode === 'inherit' ? 'Via parent (consolidated)' : `Own billing account${f.billing.parentBillingId ? `, rolls up into ${f.billing.parentBillingId}` : ''}`}</Stat>
                  <Stat label="Administrator">{f.admin.mode === 'none' ? 'Assign later' : f.admin.mode === 'existing' ? q.data.users.find((u) => u.id === f.admin.userId)?.name : `Invite ${f.admin.email}`}</Stat>
                </>
              )}
              {f.type === 'Billing' && <Stat label="Rolls up into">{f.billing.parentBillingId ?? 'Standalone'}</Stat>}
            </dl>
            {getSettings().approvalForChildAccount && f.type !== 'Billing' && <p className="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">Approval policy is on: the account will be created as Pending Approval.</p>}
            <SimNote>Creates the account and its billing relationship.</SimNote>
          </div>
        )}

        <div className="mt-6 flex justify-between border-t border-slate-100 pt-4">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button variant="cta" onClick={submit} loading={busy}>
              Submit
            </Button>
          )}
        </div>
      </Card>
      <p className="mt-3 text-center text-xs text-slate-500">
        Need a different structure? <Link to="/accounts/hierarchy" className="text-royal hover:underline">Open the hierarchy explorer</Link>.
      </p>
    </div>
  );
}
