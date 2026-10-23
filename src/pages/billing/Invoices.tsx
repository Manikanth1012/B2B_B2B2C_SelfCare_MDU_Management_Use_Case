import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { can, listInvoices, payInvoice } from '../../api/api';
import type { BillingAccount, Invoice } from '../../data/types';
import { useApi } from '../../lib/hooks';
import { date, downloadText, money, toCsv } from '../../lib/format';
import { Button, Card, DataTable, ErrorState, Field, Loading, Modal, PageHeader, SearchBox, Select, SimNote, Stat, StatusBadge, useAction } from '../../components/ui';

type Inv = Invoice & { billingName: string; currency: string };

export function downloadInvoice(i: Inv) {
  const lines = i.lines.map((l) => `<tr><td>${l.description}</td><td>${l.costCentre}</td><td style="text-align:right">${money(l.amount, i.currency)}</td></tr>`).join('');
  const tax = Math.round(i.amount * 0.18);
  downloadText(
    `${i.id}.html`,
    `<!doctype html><meta charset="utf-8"><title>${i.id}</title><body style="font-family:Poppins,Arial,sans-serif;max-width:720px;margin:32px auto;color:#1D1D1D"><h2>Tax invoice ${i.id}</h2><p>${i.billingName} · Period ${i.period}<br>Issued ${date(i.issueDate)} · Due ${date(i.dueDate)} · Status ${i.status}</p><table width="100%" cellpadding="6" style="border-collapse:collapse"><tr style="background:#F4F4F4"><th align="left">Description</th><th align="left">Cost centre</th><th align="right">Amount</th></tr>${lines}<tr><td colspan="2">GST 18%</td><td align="right">${money(tax, i.currency)}</td></tr><tr><td colspan="2"><b>Total</b></td><td align="right"><b>${money(i.amount + tax, i.currency)}</b></td></tr></table><p style="font-size:11px;color:#666">Synthetic prototype invoice — not a real tax document.</p></body>`,
    'text/html',
  );
}

export function Invoices() {
  const q = useApi(listInvoices);
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? 'All');
  const [ba, setBa] = useState('All');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Inv | null>(null);
  const [paying, setPaying] = useState<Inv | null>(null);
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const accounts = [...new Set(q.data.map((i) => i.billingName))].sort();
  const rows = q.data.filter((i) => (status === 'All' || i.status === status) && (ba === 'All' || i.billingName === ba) && (!search || `${i.id} ${i.period}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <div>
      <PageHeader
        title="Invoices"
        crumbs={[{ label: 'Billing', to: '/billing' }, { label: 'Invoices' }]}
        actions={
          <Button variant="secondary" onClick={() => downloadText('invoices.csv', toCsv([['Invoice', 'Billing account', 'Period', 'Issued', 'Due', 'Amount', 'Currency', 'Status'], ...rows.map((i) => [i.id, i.billingName, i.period, i.issueDate, i.dueDate, i.amount, i.currency, i.status])]))}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <Card>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_240px_160px]">
          <SearchBox value={search} onChange={setSearch} placeholder="Invoice number or period (YYYY-MM)" />
          <Select label="Billing account" value={ba} onChange={setBa} options={['All', ...accounts]} />
          <Select label="Status" value={status} onChange={setStatus} options={['All', 'Open', 'Overdue', 'Paid']} />
        </div>
        <DataTable
          rows={rows}
          rowKey={(i) => i.id}
          onRowClick={setOpen}
          pageSize={12}
          mobileTitle={(i) => `${i.id} · ${money(i.amount, i.currency)}`}
          columns={[
            { key: 'id', header: 'Invoice', render: (i) => <span className="font-mono text-xs">{i.id}</span>, sort: (i) => i.id, mobileHidden: true },
            { key: 'b', header: 'Billing account', render: (i) => i.billingName, sort: (i) => i.billingName },
            { key: 'p', header: 'Period', render: (i) => i.period, sort: (i) => i.period },
            { key: 'd', header: 'Due date', render: (i) => date(i.dueDate), sort: (i) => i.dueDate },
            { key: 'a', header: 'Amount', render: (i) => money(i.amount, i.currency), sort: (i) => i.amount, className: 'text-right' },
            { key: 's', header: 'Status', render: (i) => <StatusBadge status={i.status} />, sort: (i) => i.status },
            {
              key: 'x',
              header: '',
              mobileHidden: true,
              render: (i) => (
                <span className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button className="text-xs font-semibold text-royal hover:underline" onClick={() => downloadInvoice(i)}>
                    Download
                  </button>
                  {i.status !== 'Paid' && can('billing.pay') && (
                    <button className="text-xs font-semibold text-royal hover:underline" onClick={() => setPaying(i)}>
                      Pay
                    </button>
                  )}
                </span>
              ),
            },
          ]}
        />
      </Card>
      {open && (
        <Modal
          open
          wide
          onClose={() => setOpen(null)}
          title={`Invoice ${open.id}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => downloadInvoice(open)}>
                <Download className="h-4 w-4" /> Download
              </Button>
              {open.status !== 'Paid' && can('billing.pay') && <Button onClick={() => (setPaying(open), setOpen(null))}>Pay now</Button>}
            </>
          }
        >
          <dl className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Billing account">{open.billingName}</Stat>
            <Stat label="Period">{open.period}</Stat>
            <Stat label="Due">{date(open.dueDate)}</Stat>
            <Stat label="Status">
              <StatusBadge status={open.status} />
            </Stat>
          </dl>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-200 text-left text-xs text-ink-600">
                <th className="py-1.5">Description</th>
                <th>Cost centre</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {open.lines.map((l, k) => (
                <tr key={k} className="border-b border-line-100">
                  <td className="py-1.5">{l.description}</td>
                  <td className="text-xs text-slate-600">{l.costCentre}</td>
                  <td className="text-right">{money(l.amount, open.currency)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-semibold" colSpan={2}>
                  Total (excl. tax)
                </td>
                <td className="text-right font-semibold">{money(open.amount, open.currency)}</td>
              </tr>
            </tbody>
          </table>
        </Modal>
      )}
      {paying && <PayModal invoice={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

function PayModal({ invoice, onClose }: { invoice: Inv; onClose: () => void }) {
  const [method, setMethod] = useState<BillingAccount['paymentMethod']>('UPI');
  const { run, busy } = useAction();
  return (
    <Modal
      open
      onClose={onClose}
      title="Pay invoice"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={async () => (await run(() => payInvoice(invoice.id, method), (ref) => `Payment recorded (simulated) · ref ${ref}`)) && onClose()}>
            Pay {money(invoice.amount, invoice.currency)}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm">
        {invoice.id} · {invoice.billingName} · due {date(invoice.dueDate)}
      </p>
      <Field label="Payment method">
        <Select label="Payment method" value={method} onChange={(v) => setMethod(v as typeof method)} options={['UPI', 'Card', 'Bank Transfer', 'Direct Debit']} />
      </Field>
      <div className="mt-3">
        <SimNote>No payment gateway is called and no card data is collected. The invoice is marked paid in the mock billing system.</SimNote>
      </div>
    </Modal>
  );
}
