import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { listInvoices, toReporting } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { downloadText, money, pct, toCsv } from '../../lib/format';
import { Button, Card, ErrorState, Loading, PageHeader, Select } from '../../components/ui';
import { CHART } from '../Dashboard';

export function CostAllocation() {
  const q = useApi(listInvoices);
  const [period, setPeriod] = useState('2026-10');
  const [group, setGroup] = useState<'costCentre' | 'billing'>('costCentre');
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const periods = [...new Set(q.data.map((i) => i.period))].sort().reverse();
  const totals = new Map<string, number>();
  q.data
    .filter((i) => i.period === period && !i.billingName.endsWith('– Home'))
    .forEach((i) =>
      i.lines.forEach((l) => {
        const k = group === 'costCentre' ? l.costCentre : i.billingName;
        totals.set(k, (totals.get(k) ?? 0) + toReporting(l.amount, i.currency));
      }),
    );
  const rows = [...totals.entries()].map(([name, amount]) => ({ name, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount);
  const sum = rows.reduce((a, r) => a + r.amount, 0);
  const top = rows.slice(0, 12);
  return (
    <div>
      <PageHeader
        title="Cost Allocation"
        subtitle="Allocate charges by department, branch, property common area or unit (from invoice cost centres)."
        crumbs={[{ label: 'Billing', to: '/billing' }, { label: 'Cost allocation' }]}
        actions={
          <Button variant="secondary" onClick={() => downloadText(`cost-allocation-${period}.csv`, toCsv([['Allocation', 'Amount (USD)', 'Share %'], ...rows.map((r) => [r.name, r.amount, pct(r.amount, sum)])]))}>
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <Select label="Period" value={period} onChange={setPeriod} options={periods} className="w-36" />
        <Select label="Group by" value={group} onChange={(v) => setGroup(v as typeof group)} options={[{ value: 'costCentre', label: 'Cost centre (department / site / unit)' }, { value: 'billing', label: 'Billing account' }]} className="w-72" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Top allocations · ${period}`}>
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={top} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDEDED" />
                <XAxis type="number" fontSize={11} tickFormatter={(v) => money(v, 'USD', true)} />
                <YAxis type="category" dataKey="name" width={150} fontSize={11} />
                <Tooltip formatter={(v: number) => money(v)} />
                <Bar dataKey="amount" fill={CHART.royal} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={`All allocations (${rows.length}) · total ${money(sum)}`}>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b border-line-100">
                    <td className="py-1.5">{r.name}</td>
                    <td className="text-right">{money(r.amount)}</td>
                    <td className="w-16 text-right text-xs text-slate-500">{pct(r.amount, sum)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="py-6 text-center text-sm text-slate-500">No invoices for this period.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
