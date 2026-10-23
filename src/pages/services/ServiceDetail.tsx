import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Network, PhoneCall, PlayCircle, Radio, Wifi } from 'lucide-react';
import { can, getService, listInvoices, offerings, requestServiceChange } from '../../api/api';
import { TODAY } from '../../data/seed';
import { useApi } from '../../lib/hooks';
import { date, money } from '../../lib/format';
import { Button, Card, ErrorState, Field, inputCls, Loading, Modal, PageHeader, SearchBox, SimNote, Stat, StatusBadge, Tag, useAction } from '../../components/ui';
import { StatusTile } from '../../components/template';

export function ServiceDetail() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const q = useApi(() => getService(id), [id]);
  const [modal, setModal] = useState<'plan' | 'suspend' | 'resume' | null>(null);
  const [addOnOpen, setAddOnOpen] = useState(false);
  const [usage, setUsage] = useState(false);
  const [search, setSearch] = useState('');
  const nav = useNavigate();
  useEffect(() => {
    const a = params.get('action');
    if (a === 'plan' || a === 'suspend' || a === 'resume') setModal(a);
  }, [params]);
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const s = q.data;
  const close = () => {
    setModal(null);
    setParams({}, { replace: true });
  };
  const blocked = s.pendingChange ? `A change is already pending: ${s.pendingChange}` : null;
  const order = can('service.order');
  const activeAddOns = (s.offering.addOns ?? []).filter((a) => s.addOns.includes(a.id) && a.name.toLowerCase().includes(search.toLowerCase()));
  const Icon = s.category === 'FTTH Broadband' ? Wifi : s.category === 'Voice' ? PhoneCall : s.category === 'IoT' ? Radio : Network;
  return (
    <div>
      <PageHeader title={s.offeringName} subtitle={<span><span className="font-mono text-xs">{s.id}</span> · {s.location}</span>} crumbs={[{ label: 'Services', to: '/services' }, { label: s.id }]} />
      {s.pendingChange && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">Pending change: <b>{s.pendingChange}</b>. The live service is unchanged until the order is fulfilled.</div>}

      <h2 className="border-b border-line-200 pb-2 text-[26px] font-medium text-ink-700">Current Active Offer</h2>
      <div className="mb-10 mt-6 grid gap-6 lg:grid-cols-2">
        <StatusTile status="Current Service" tone="blue">
          <Icon className="h-8 w-8 text-ink-400" />
          <p className="mt-3 text-sm text-ink-400">
            Offer Description: <span className="text-base font-medium text-navy">{s.offeringName}{s.offering.speed ? ` · ${s.offering.speed}` : ''}</span>
          </p>
          <p className="mt-1 text-sm text-ink-400">
            Activation Date: <span className="text-base font-medium text-navy">{s.activationDate ? date(s.activationDate) : 'NA'}</span>
          </p>
          <p className="mt-1 text-sm text-ink-400">
            Status: <StatusBadge status={s.status} />
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => setUsage(true)} className="text-[15px] font-bold text-royal hover:underline">
              Usage Info
            </button>
            {order && (
              <Button disabled={s.status !== 'Active' || !!blocked} title={blocked ?? undefined} onClick={() => setModal('plan')}>
                Change Plan
              </Button>
            )}
          </div>
        </StatusTile>
        <StatusTile status={s.status === 'Suspended' ? 'Suspended' : 'Contract'} tone={s.status === 'Suspended' ? 'amber' : 'grey'}>
          <dl className="grid grid-cols-2 gap-4">
            <Stat label="Monthly charge">{money(s.mrc, s.currency)}</Stat>
            <Stat label="Contract term">{s.offering.contractMonths} months</Stat>
            <Stat label="Contract end">{date(s.contractEnd)}</Stat>
            <Stat label="Billing account">{s.billingName}</Stat>
            <Stat label="Customer / account">{s.businessAccountId ? <Link className="text-royal hover:underline" to={`/accounts/${s.businessAccountId}`}>{s.customerName}</Link> : s.customerName}</Stat>
            <Stat label="Unit">{s.unitId ? <Link className="text-royal hover:underline" to={`/mdu/${s.propertyId}`}>{s.unitNumber}</Link> : '—'}</Stat>
          </dl>
          {order && (
            <div className="mt-5 flex justify-end">
              {s.status === 'Suspended' ? (
                <Button variant="secondary" disabled={!!blocked} onClick={() => setModal('resume')}>
                  <PlayCircle className="h-4 w-4" /> Request Reactivation
                </Button>
              ) : (
                <button disabled={s.status !== 'Active' || !!blocked} onClick={() => setModal('suspend')} className="text-[15px] font-bold text-royal hover:underline disabled:text-ink-400 disabled:no-underline">
                  Request Service Suspension
                </button>
              )}
            </div>
          )}
        </StatusTile>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-200 pb-3">
        <h2 className="text-[26px] font-medium text-ink-700">Current Add-on(s)</h2>
        <div className="w-full sm:w-96">
          <SearchBox value={search} onChange={setSearch} placeholder="Search" />
        </div>
      </div>
      <div className="mb-10 mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {activeAddOns.map((a) => (
          <div key={a.id} className="flex min-h-[200px] flex-col justify-between rounded-card border border-line-100 bg-brand-soft p-6">
            <div>
              <p className="text-lg font-semibold text-navy">{a.name}</p>
              <p className="mt-1 text-sm text-ink-600">{money(a.mrc, s.currency)} / month</p>
            </div>
            <StatusBadge status="Active" />
          </div>
        ))}
        {order && (
          <button onClick={() => setAddOnOpen(true)} disabled={s.status !== 'Active' || !(s.offering.addOns ?? []).some((a) => !s.addOns.includes(a.id))} className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-card border border-line-100 bg-brand-soft p-6 text-lg font-semibold text-navy transition hover:shadow-md disabled:opacity-50">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-100 text-3xl">+</span>
            Add Add-on(s)
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Associated equipment">
          {s.equipment.length ? (
            <ul className="space-y-2 text-sm">
              {s.equipment.map((e) => (
                <li key={e.serial} className="rounded-xl border border-line-100 p-3">
                  <p className="font-medium text-navy">{e.type}</p>
                  <p className="font-mono text-xs text-ink-400">S/N {e.serial}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-600">Not yet installed.</p>
          )}
        </Card>
        <Card title="Orders & requests on this service" className="lg:col-span-2">
          {s.requests.length ? (
            <ul className="divide-y divide-line-100">
              {s.requests.map((r) => (
                <li key={r.id}>
                  <button onClick={() => nav(`/requests/${r.id}`)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:bg-surface-50">
                    <span className="font-mono text-xs text-ink-400">{r.id}</span>
                    <span className="flex-1">{r.title}</span>
                    <StatusBadge status={r.status} />
                    <span className="w-24 text-right text-xs text-ink-400">{date(r.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-600">No orders or requests yet.</p>
          )}
        </Card>
      </div>
      {modal && <ChangeModal kind={modal} service={s} onClose={close} />}
      {addOnOpen && <AddOnModal service={s} onClose={() => setAddOnOpen(false)} />}
      {usage && <UsageModal serviceId={s.id} currency={s.currency} onClose={() => setUsage(false)} />}
    </div>
  );
}

function AddOnModal({ service, onClose }: { service: Awaited<ReturnType<typeof getService>>; onClose: () => void }) {
  const avail = (service.offering.addOns ?? []).filter((a) => !service.addOns.includes(a.id));
  const [sel, setSel] = useState(avail[0]?.id ?? '');
  const { run, busy } = useAction();
  const nav = useNavigate();
  return (
    <Modal
      open
      onClose={onClose}
      title="Add add-on"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!sel} onClick={async () => { const r = await run(() => requestServiceChange(service.id, { kind: 'Add-on', addOnId: sel }), 'Add-on order submitted'); if (r) { onClose(); nav(`/requests/${r}`); } }}>
            Order add-on
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {avail.map((a) => (
          <label key={a.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${sel === a.id ? 'border-crimson bg-crimson-50' : 'border-line-200'}`}>
            <input type="radio" checked={sel === a.id} onChange={() => setSel(a.id)} />
            <span className="flex-1 font-medium text-navy">{a.name}</span>
            <span className="font-semibold">+{money(a.mrc)}/mo</span>
          </label>
        ))}
      </div>
      <div className="mt-3">
        <SimNote>Submits a TMF622 modify order (simulated). The add-on is applied and billed once the order is fulfilled.</SimNote>
      </div>
    </Modal>
  );
}

function UsageModal({ serviceId, currency, onClose }: { serviceId: string; currency: string; onClose: () => void }) {
  const q = useApi(listInvoices);
  const lines = (q.data ?? []).flatMap((i) => i.lines.filter((l) => l.serviceId === serviceId).map((l) => ({ period: i.period, amount: l.amount, description: l.description }))).sort((a, b) => b.period.localeCompare(a.period));
  return (
    <Modal open onClose={onClose} title="Usage info" footer={<Button onClick={onClose}>Close</Button>}>
      {!q.data ? (
        <Loading />
      ) : lines.length ? (
        <table className="w-full text-sm">
          <tbody>
            {lines.map((l) => (
              <tr key={l.period + l.description} className="border-b border-line-100">
                <td className="py-2">{l.period}</td>
                <td className="py-2 text-ink-600">{l.description}</td>
                <td className="py-2 text-right font-semibold">{money(l.amount, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-ink-600">Not measured — no billed usage is visible to you for this service (it may be billed to a resident or not yet invoiced).</p>
      )}
    </Modal>
  );
}

function ChangeModal({ kind, service, onClose }: { kind: 'plan' | 'suspend' | 'resume'; service: Awaited<ReturnType<typeof getService>>; onClose: () => void }) {
  const options = offerings().filter((o) => o.category === service.offering.category && o.segment === service.offering.segment && o.id !== service.offeringId && !o.id.startsWith('OFF-P'));
  const [plan, setPlan] = useState(options[0]?.id ?? '');
  const [from, setFrom] = useState(TODAY);
  const [until, setUntil] = useState('');
  const [reason, setReason] = useState('');
  const { run, busy } = useAction();
  const nav = useNavigate();
  const sel = options.find((o) => o.id === plan);
  const submit = async () => {
    const change = kind === 'plan' ? { kind: 'Plan Change' as const, offeringId: plan } : kind === 'suspend' ? { kind: 'Suspension' as const, from, until: until || undefined, reason } : { kind: 'Resumption' as const };
    const r = await run(() => requestServiceChange(service.id, change), 'Change order submitted');
    if (r) {
      onClose();
      nav(`/requests/${r}`);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={kind === 'plan' ? 'Change plan' : kind === 'suspend' ? 'Request temporary suspension' : 'Request reactivation'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={submit} disabled={(kind === 'plan' && !plan) || (kind === 'suspend' && (!reason.trim() || (!!until && until <= from)))}>
            Submit order
          </Button>
        </>
      }
    >
      {kind === 'plan' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Current: {service.offeringName} · {money(service.mrc, service.currency)}/month</p>
          {options.map((o) => (
            <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm ${plan === o.id ? 'border-crimson bg-crimson-50' : 'border-line-200'}`}>
              <input type="radio" checked={plan === o.id} onChange={() => setPlan(o.id)} />
              <span className="flex-1">
                <span className="font-medium text-navy">{o.name}</span> <span className="text-xs text-slate-500">{o.speed}</span>
              </span>
              <span className="font-semibold">{money(o.mrc)}/mo</span>
              <Tag className={o.mrc > service.mrc ? '' : 'bg-surface-100 text-ink-700'}>{o.mrc > service.mrc ? 'Upgrade' : 'Downgrade'}</Tag>
            </label>
          ))}
          {sel && <p className="text-xs text-slate-600">Monthly charge changes by {money(sel.mrc - service.mrc)}; pro-rated from the fulfilment date.</p>}
          {!options.length && <p className="text-sm text-slate-500">No alternative plans in this product family.</p>}
        </div>
      )}
      {kind === 'suspend' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Suspend from">
            <input type="date" className={inputCls} value={from} min={TODAY} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Until (optional)" error={until && until <= from ? 'Must be after start date' : undefined}>
            <input type="date" className={inputCls} value={until} onChange={(e) => setUntil(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Reason" required>
              <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Unit under renovation" />
            </Field>
          </div>
          <p className="text-xs text-slate-600 sm:col-span-2">A retention charge of 20% of the monthly charge applies while suspended.</p>
        </div>
      )}
      {kind === 'resume' && <p className="text-sm text-slate-700">Reactivate {service.offeringName} at {service.location}? Full monthly charges resume on fulfilment.</p>}
      <div className="mt-3">
        <SimNote>Submits a TMF622 product order (simulated). The live service changes only when the order is fulfilled — nothing is silently altered.</SimNote>
      </div>
    </Modal>
  );
}
