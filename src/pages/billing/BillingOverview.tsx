import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { can, listBillingAccounts, listInvoices, listPayments, toReporting } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date, money } from '../../lib/format';
import { Card, ErrorState, Kpi, LinkButton, Loading, PageHeader, Select, Tabs, Tag } from '../../components/ui';
import { BlushPanel, InfoGrid } from '../../components/template';
import { CHART } from '../Dashboard';
import { InvoicesPanel } from './Invoices';
import { PaymentsPanel } from './Payments';

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
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'invoices';
  const setTab = (t: string) => setParams({ tab: t }, { replace: true });
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
      <BlushPanel title="Current Bill" actions={can('billing.pay') && outstanding > 0 && <LinkButton to="/billing?tab=invoices&status=Overdue" variant="primary">Pay now</LinkButton>}>
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
        <Kpi label="Overdue amount" value={money(overdue, ccy, true)} tone={overdue ? 'red' : 'green'} to="/billing?tab=invoices&status=Overdue" />
        <Kpi label="Open invoices" value={invoices.filter((i) => i.status === 'Open').length} tone="orange" to="/billing?tab=invoices&status=Open" />
        <Kpi label="Payments (6 months)" value={pays.length} tone="green" to="/billing?tab=payments" />
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
      {tab === 'invoices' && <InvoicesPanel key={acc + (params.get('status') ?? '')} accountId={acc} />}
      {tab === 'payments' && <PaymentsPanel accountId={acc} />}
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
