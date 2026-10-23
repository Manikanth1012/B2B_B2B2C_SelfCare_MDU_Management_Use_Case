import { listPayments } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date, money } from '../../lib/format';
import { DataTable, ErrorState, Loading, Tag } from '../../components/ui';

/** Payment history. Rendered as the "Payment History" tab of Bills & Payments. */
export function PaymentsPanel({ accountId = 'ALL' }: { accountId?: string }) {
  const q = useApi(listPayments);
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const rows = q.data.filter((p) => accountId === 'ALL' || p.billingAccountId === accountId);
  return (
    <DataTable
      rows={rows}
      rowKey={(p) => p.id}
      pageSize={10}
      empty="No Data Found"
      mobileTitle={(p) => `${money(p.amount, p.currency)} · ${date(p.date)}`}
      columns={[
        { key: 'd', header: 'Payment Date', render: (p) => date(p.date), sort: (p) => p.date },
        { key: 'r', header: 'Receipt Number', render: (p) => <span className="font-mono text-xs">{p.reference}</span> },
        { key: 'b', header: 'Billing Account', render: (p) => <span className="text-xs">{p.billingName}</span>, sort: (p) => p.billingName },
        { key: 'a', header: 'Amount Paid', render: (p) => money(p.amount, p.currency), sort: (p) => p.amount, className: 'text-right' },
        { key: 'c', header: 'Comment', render: (p) => <span className="text-xs">{p.invoiceId} · {p.method}</span> },
        { key: 's', header: '', render: () => <Tag className="bg-surface-100 text-ink-600">Simulated</Tag>, mobileHidden: true },
      ]}
    />
  );
}
