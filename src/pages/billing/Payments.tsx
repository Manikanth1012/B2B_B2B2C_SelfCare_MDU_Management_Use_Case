import { listPayments } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date, money } from '../../lib/format';
import { Card, DataTable, ErrorState, LinkButton, Loading, PageHeader, Tag } from '../../components/ui';

export function Payments() {
  const q = useApi(listPayments);
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  return (
    <div>
      <PageHeader title="Payments" subtitle="Payment history across your authorised billing accounts." crumbs={[{ label: 'Billing', to: '/billing' }, { label: 'Payments' }]} actions={<LinkButton to="/billing/invoices?status=Open" variant="primary">Pay open invoices</LinkButton>} />
      <Card>
        <DataTable
          rows={q.data}
          rowKey={(p) => p.id}
          pageSize={15}
          mobileTitle={(p) => `${money(p.amount, p.currency)} · ${date(p.date)}`}
          columns={[
            { key: 'd', header: 'Date', render: (p) => date(p.date), sort: (p) => p.date },
            { key: 'b', header: 'Billing account', render: (p) => p.billingName, sort: (p) => p.billingName },
            { key: 'i', header: 'Invoice', render: (p) => <span className="font-mono text-xs">{p.invoiceId}</span> },
            { key: 'm', header: 'Method', render: (p) => p.method },
            { key: 'r', header: 'Reference', render: (p) => <span className="font-mono text-xs">{p.reference}</span> },
            { key: 'a', header: 'Amount', render: (p) => money(p.amount, p.currency), sort: (p) => p.amount, className: 'text-right' },
            { key: 's', header: '', render: () => <Tag className="bg-surface-100 text-ink-600">Simulated</Tag>, mobileHidden: true },
          ]}
        />
      </Card>
    </div>
  );
}
