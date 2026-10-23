import { useEffect, useState } from 'react';
import { can, currentUser, listBillingAccounts, updateBillingPreferences } from '../../api/api';
import type { BillingAccount } from '../../data/types';
import { useApi } from '../../lib/hooks';
import { Button, Card, ErrorState, Field, inputCls, Loading, PageHeader, Select, Stat, useAction } from '../../components/ui';

export function Preferences() {
  const q = useApi(() => listBillingAccounts({ includeResidents: true }));
  const [id, setId] = useState('');
  const [f, setF] = useState<Pick<BillingAccount, 'paymentMethod' | 'invoiceDelivery' | 'paperless' | 'billCycleDay'> | null>(null);
  const { run, busy } = useAction();
  const sel = q.data?.find((b) => b.id === (id || q.data?.[0]?.id));
  useEffect(() => {
    if (sel) setF({ paymentMethod: sel.paymentMethod, invoiceDelivery: sel.invoiceDelivery, paperless: sel.paperless, billCycleDay: sel.billCycleDay });
  }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data || !f) return <Loading />;
  const editable = can('billing.manage') || currentUser().roleId === 'RESIDENT';
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Billing Preferences" crumbs={[{ label: 'Billing', to: '/billing' }, { label: 'Preferences' }]} />
      <Card>
        <Field label="Billing account">
          <Select label="Billing account" value={sel!.id} onChange={setId} options={q.data.map((b) => ({ value: b.id, label: `${b.name} (${b.id})` }))} />
        </Field>
        <dl className="my-4 grid grid-cols-3 gap-3 rounded bg-surface-50 p-3">
          <Stat label="Type">{sel!.type}</Stat>
          <Stat label="Payer">{sel!.payerName}</Stat>
          <Stat label="Currency">{sel!.currency}</Stat>
        </dl>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Payment method">
            <select disabled={!editable} className={inputCls} value={f.paymentMethod} onChange={(e) => setF({ ...f, paymentMethod: e.target.value as BillingAccount['paymentMethod'] })}>
              {['Bank Transfer', 'Direct Debit', 'Card', 'ACH'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Invoice delivery">
            <select disabled={!editable} className={inputCls} value={f.invoiceDelivery} onChange={(e) => setF({ ...f, invoiceDelivery: e.target.value as BillingAccount['invoiceDelivery'] })}>
              {['Email', 'Portal', 'Post'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Bill cycle day" hint="1–28" error={f.billCycleDay < 1 || f.billCycleDay > 28 ? 'Must be 1–28' : undefined}>
            <input disabled={!editable} type="number" min={1} max={28} className={inputCls} value={f.billCycleDay} onChange={(e) => setF({ ...f, billCycleDay: Number(e.target.value) })} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input disabled={!editable} type="checkbox" checked={f.paperless} onChange={(e) => setF({ ...f, paperless: e.target.checked })} /> Paperless billing
          </label>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-line-100 pt-4">
          {!editable ? <p className="text-xs text-slate-500">Read-only for your role.</p> : <span />}
          <Button disabled={!editable} loading={busy} onClick={() => run(() => updateBillingPreferences(sel!.id, f), 'Preferences saved')}>
            Save preferences
          </Button>
        </div>
      </Card>
    </div>
  );
}
