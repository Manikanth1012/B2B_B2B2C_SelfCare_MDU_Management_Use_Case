import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, Repeat } from 'lucide-react';
import { can, getBillingHierarchy, listInvoices, type BillingNode } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date, money } from '../../lib/format';
import { Button, Card, DataTable, ErrorState, Loading, PageHeader, Stat, StatusBadge, Tabs, Tag } from '../../components/ui';
import { ReassignBillingModal } from './ReassignBillingModal';

function flatten(n: BillingNode[]): BillingNode[] {
  return n.flatMap((x) => [x, ...flatten(x.children)]);
}

export function BillingHierarchy() {
  const q = useApi(getBillingHierarchy);
  const inv = useApi(listInvoices);
  const [params, setParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState('consolidated');
  const [rebill, setRebill] = useState(false);
  const nav = useNavigate();
  const all = useMemo(() => (q.data ? flatten(q.data) : []), [q.data]);
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data || !inv.data) return <Loading />;
  const focus = all.find((n) => n.billing.id === params.get('focus')) ?? q.data[0];
  if (!focus) return <PageHeader title="Billing Hierarchy" subtitle="No billing accounts in your scope." />;
  const subtree = flatten([focus]);
  const subIds = new Set(subtree.map((n) => n.billing.id));
  const invoices = inv.data.filter((i) => (tab === 'consolidated' ? subIds.has(i.billingAccountId) : i.billingAccountId === focus.billing.id));

  const render = (n: BillingNode, depth: number): React.ReactNode => {
    const open = !collapsed.has(n.billing.id);
    const sel = n.billing.id === focus.billing.id;
    return (
      <li key={n.billing.id}>
        <div className={clsx('flex items-center gap-1 rounded-md py-1.5 pr-2', sel ? 'bg-crimson-50 ring-1 ring-crimson' : 'hover:bg-surface-50')} style={{ paddingLeft: depth * 20 + 4 }}>
          {n.children.length ? (
            <button aria-label={open ? 'Collapse' : 'Expand'} className="rounded p-0.5 hover:bg-surface-100" onClick={() => setCollapsed((c) => (open ? new Set([...c, n.billing.id]) : new Set([...c].filter((x) => x !== n.billing.id))))}>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <button className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left text-sm" onClick={() => setParams({ focus: n.billing.id }, { replace: true })}>
            <Tag>{n.billing.type}</Tag>
            <span className="font-medium text-navy">{n.billing.name}</span>
            <span className="font-mono text-[11px] text-slate-500">{n.billing.id}</span>
            <span className="text-xs text-slate-500">pays: {n.billing.payerName}</span>
            <span className="ml-auto text-xs">
              <span className="text-slate-500">rolled-up balance</span> <b>{money(n.rolledUpBalance)}</b>
            </span>
          </button>
        </div>
        {open && n.children.length > 0 && <ul>{n.children.map((c) => render(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div>
      <PageHeader
        title="Billing Hierarchy"
        subtitle="Who pays for what. Billing roll-ups are separate from organisational ownership and physical location."
        crumbs={[{ label: 'Billing', to: '/billing' }, { label: 'Hierarchy' }]}
        actions={
          (can('billing.manage') || can('account.edit')) && (
            <Button variant="secondary" onClick={() => setRebill(true)}>
              <Repeat className="h-4 w-4" /> Billing reassignment request
            </Button>
          )
        }
      />
      <div className="grid gap-4 xl:grid-cols-5">
        <Card title="Billing accounts" className="xl:col-span-2">
          <ul className="text-sm">{q.data.map((n) => render(n, 0))}</ul>
          <p className="mt-3 text-[11px] text-slate-500">Rolled-up balances include child billing accounts.</p>
        </Card>
        <div className="space-y-4 xl:col-span-3">
          <Card title={focus.billing.name} actions={<StatusBadge status={focus.billing.status} />}>
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Responsible paying party">{focus.billing.payerName}</Stat>
              <Stat label="Own balance">{money(focus.billing.balance, focus.billing.currency)}</Stat>
              <Stat label="Consolidated balance (USD)">{money(focus.rolledUpBalance)}</Stat>
              <Stat label="Consolidated current charges">{money(focus.rolledUpCharges)}</Stat>
              <Stat label="Payment method">{focus.billing.paymentMethod}</Stat>
              <Stat label="Bill cycle day">{focus.billing.billCycleDay}</Stat>
              <Stat label="Child billing accounts">{focus.children.length}</Stat>
              <Stat label="Services billed here">{focus.services.length}</Stat>
            </dl>
          </Card>
          <Card title="Services and subscriptions billed to this account">
            <DataTable
              rows={focus.services}
              rowKey={(s) => s.id}
              onRowClick={(s) => nav(`/services/${s.id}`)}
              pageSize={6}
              mobileTitle={(s) => s.offeringName}
              empty="No services billed directly; see child accounts."
              columns={[
                { key: 'p', header: 'Service', render: (s) => s.offeringName, mobileHidden: true },
                { key: 'l', header: 'Delivered at', render: (s) => <span className="text-xs">{s.location}</span> },
                { key: 's', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
                { key: 'm', header: 'MRC', render: (s) => money(s.mrc, focus.billing.currency), className: 'text-right' },
              ]}
            />
          </Card>
          <Card title="Invoices">
            <Tabs
              active={tab}
              onChange={setTab}
              tabs={[
                { id: 'consolidated', label: 'Consolidated view (incl. children)' },
                { id: 'own', label: 'This account only' },
              ]}
            />
            <DataTable
              rows={invoices}
              rowKey={(i) => i.id}
              onRowClick={() => nav('/billing/invoices')}
              pageSize={8}
              mobileTitle={(i) => i.id}
              columns={[
                { key: 'id', header: 'Invoice', render: (i) => <span className="font-mono text-xs">{i.id}</span>, mobileHidden: true },
                { key: 'b', header: 'Billing account', render: (i) => i.billingName },
                { key: 'p', header: 'Period', render: (i) => i.period, sort: (i) => i.period },
                { key: 'a', header: 'Amount', render: (i) => money(i.amount, i.currency), className: 'text-right' },
                { key: 'd', header: 'Due', render: (i) => date(i.dueDate) },
                { key: 's', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
              ]}
            />
          </Card>
        </div>
      </div>
      {rebill && <ReassignBillingModal services={all.flatMap((n) => n.services)} onClose={() => setRebill(false)} />}
    </div>
  );
}
