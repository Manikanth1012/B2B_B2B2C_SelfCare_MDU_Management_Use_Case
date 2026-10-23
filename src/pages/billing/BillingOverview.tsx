import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { can, listBillingAccounts, listInvoices, listPayments, toReporting } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date, money } from '../../lib/format';
import { Card, DataTable, ErrorState, Kpi, LinkButton, Loading, PageHeader, Select, StatusBadge, Tabs, Tag } from '../../components/ui';
import { BlushPanel, InfoGrid } from '../../components/template';
import { CHART } from '../Dashboard';
import { downloadInvoice } from './Invoices';

async function load() {
  const [billing, invoices, payments] = await Promise.all([listBillingAccounts({ includeResidents: true }), listInvoices(), listPayments()]);
  return { billing, invoices, payments };
}

function monthEnd(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function BillingOverview() {
  const q = useApi(load);
  const [tab, setTab] = useState('invoices');
  const [acc, setAcc] = useState('ALL');
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const { billing, payments } = q.data;
  const invoices = q.data.invoices.filter((i) => acc === 'ALL' || i.billingAccountId === acc);
  const pays = payments.filter((p) => acc === 'ALL' || p.billingAccountId === acc);
  const sel = billing.find((b) => b.id === acc);
  const cur = (i: { amount: number; currency: string }) => toReporting(i.amount, i.currency);
  const ccy = sel?.currency ?? 'USD';
  const amt = (i: { amount: number; currency: string }) => (sel ? i.amount : cur(i));
  const latestPeriod = invoices.map((i) => i.period).sort().pop() ?? '2026-10';
  const latest = invoices.filter((i) => i.period === latestPeriod);
  const current = latest.reduce((a, i) => a + amt(i), 0);
  const outstanding = invoices.filter((i) => i.status !== 'Paid').reduce((a, i) => a + amt(i), 0);
  const overdue = invoices.filter((i) => i.status === 'Overdue').reduce((a, i) => a + amt(i), 0);
  const issue = latest[0]?.issueDate;
  const due = latest.map((i) => i.dueDate).sort()[0];
  const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
  const trend = months.map((m) => ({
    month: new Date(m + '-01').toLocaleString('en', { month: 'short' }),
    Paid: Math.round(invoices.filter((i) => i.period === m && i.status === 'Paid').reduce((a, i) => a + amt(i), 0)),
    Open: Math.round(invoices.filter((i) => i.period === m && i.status === 'Open').reduce((a, i) => a + amt(i), 0)),
    Overdue: Math.round(invoices.filter((i) => i.period === m && i.status === 'Overdue').reduce((a, i) => a + amt(i), 0)),
  }));

  return (
    <div>
      <PageHeader
        title="Bills & Payments"
        actions={
          billing.length > 1 && <Select label="Billing account" value={acc} onChange={setAcc} options={[{ value: 'ALL', label: `All billing accounts (${billing.length})` }, ...billing.map((b) => ({ value: b.id, label: `${b.name} (${b.id})` }))]} className="w-80" />
        }
      />
      <BlushPanel title="Current Bill" actions={can('billing.pay') && outstanding > 0 && <LinkButton to="/billing/invoices?status=Overdue" variant="primary">Pay now</LinkButton>}>
        <InfoGrid
          rows={[
            [
              { label: 'Account', value: sel ? sel.id : `${billing.length} billing accounts` },
              { label: 'Invoice Date', value: date(issue) },
              { label: 'Due Date', value: date(due) },
            ],
            [
              { label: 'Bill Duration', value: `${date(latestPeriod + '-01')} - ${date(monthEnd(latestPeriod))}` },
              { label: 'Current Month Charge', value: money(current, ccy), highlight: true },
              { label: 'Total Due Amount', value: <span className={overdue ? 'text-crimson' : ''}>{money(outstanding, ccy)}</span>, highlight: true },
            ],
          ]}
        />
        {!sel && billing.length > 1 && <p className="mt-2 text-[11px] text-ink-400">Totals consolidated across all billing accounts in USD.</p>}
      </BlushPanel>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Overdue amount" value={money(overdue, ccy, true)} tone={overdue ? 'red' : 'green'} to="/billing/invoices?status=Overdue" />
        <Kpi label="Open invoices" value={invoices.filter((i) => i.status === 'Open').length} tone="orange" to="/billing/invoices?status=Open" />
        <Kpi label="Payments (6 months)" value={pays.length} tone="green" to="/billing/payments" />
        <Kpi label="Active billing accounts" value={billing.filter((b) => b.status === 'Active').length} to="/billing/hierarchy" />
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'invoices', label: 'Invoice History' },
          { id: 'payments', label: 'Payment History' },
          { id: 'trend', label: 'Trend & Accounts' },
        ]}
      />
      {tab === 'invoices' && (
        <DataTable
          rows={invoices}
          rowKey={(i) => i.id}
          onRowClick={() => nav('/billing/invoices')}
          pageSize={8}
          mobileTitle={(i) => i.id}
          empty="No Data Found"
          columns={[
            { key: 'id', header: 'Invoice ID', render: (i) => <span className="font-mono text-xs">{i.id}</span>, mobileHidden: true },
            { key: 'd', header: 'Invoice Date', render: (i) => date(i.issueDate), sort: (i) => i.issueDate },
            { key: 'b', header: 'Billing Account', render: (i) => <span className="text-xs">{i.billingName}</span> },
            { key: 'c', header: 'Invoice Charge', render: (i) => money(i.amount, i.currency), className: 'text-right' },
            { key: 'o', header: 'Outstanding', render: (i) => money(i.status === 'Paid' ? 0 : i.amount, i.currency), className: 'text-right' },
            { key: 'due', header: 'Due Date', render: (i) => date(i.dueDate) },
            { key: 'f', header: 'From Date', render: (i) => date(i.period + '-01') },
            { key: 't', header: 'To Date', render: (i) => date(monthEnd(i.period)) },
            { key: 's', header: 'Payment Status', render: (i) => <StatusBadge status={i.status === 'Paid' ? 'Paid' : i.status === 'Overdue' ? 'Overdue' : 'Open'} /> },
            {
              key: 'dl',
              header: 'Download',
              render: (i) => (
                <button aria-label={`Download ${i.id}`} onClick={(e) => (e.stopPropagation(), downloadInvoice(i))} className="text-ink-700 hover:text-crimson">
                  <Download className="h-5 w-5" />
                </button>
              ),
            },
          ]}
        />
      )}
      {tab === 'payments' && (
        <DataTable
          rows={pays}
          rowKey={(p) => p.id}
          pageSize={8}
          mobileTitle={(p) => money(p.amount, p.currency)}
          empty="No Data Found"
          columns={[
            { key: 'd', header: 'Payment Date', render: (p) => date(p.date), sort: (p) => p.date },
            { key: 'r', header: 'Receipt Number', render: (p) => <span className="font-mono text-xs">{p.reference}</span> },
            { key: 'a', header: 'Amount Paid', render: (p) => money(p.amount, p.currency), className: 'text-right' },
            { key: 'c', header: 'Comment', render: (p) => <span className="text-xs">{p.invoiceId} · {p.method} · simulated</span> },
          ]}
        />
      )}
      {tab === 'trend' && (
        <div className="grid gap-6 xl:grid-cols-5">
          <Card title={`Invoice trend by status (${ccy})`} className="xl:col-span-3">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ECECEF" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={11} width={70} tickFormatter={(v) => money(v, ccy, true)} />
                  <Tooltip formatter={(v: number) => money(v, ccy)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Paid" stackId="a" fill={CHART.green} />
                  <Bar dataKey="Open" stackId="a" fill={CHART.royal} />
                  <Bar dataKey="Overdue" stackId="a" fill={CHART.red} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Billing accounts" className="xl:col-span-2">
            <ul className="divide-y divide-line-100">
              {billing.slice(0, 8).map((b) => (
                <li key={b.id}>
                  <button onClick={() => nav(`/billing/hierarchy?focus=${b.id}`)} className="flex w-full items-center gap-2 py-2.5 text-left text-sm hover:bg-surface-50">
                    <span className="flex-1 font-medium text-navy">{b.name}</span>
                    <Tag>{b.type}</Tag>
                    <span className="w-28 text-right">{money(b.balance, b.currency)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
