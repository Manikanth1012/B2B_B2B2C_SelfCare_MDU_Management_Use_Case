import { useState } from 'react';
import clsx from 'clsx';
import { listBillingAccounts, requestBillingReassignment } from '../../api/api';
import type { ServiceInstance } from '../../data/types';
import { useApi } from '../../lib/hooks';
import { Button, Field, inputCls, Modal, Select, SimNote, useAction } from '../../components/ui';

export function ReassignBillingModal({ services, onClose }: { services: (ServiceInstance & { offeringName: string })[]; onClose: () => void }) {
  const billing = useApi(() => listBillingAccounts());
  const [sel, setSel] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const { run, busy } = useAction();
  const targets = (billing.data ?? []).filter((b) => b.status === 'Active');
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Request billing reassignment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={!sel.length || !target || !reason.trim()}
            onClick={async () => {
              const r = await run(() => requestBillingReassignment(sel, target, reason), (x) => (x.pendingApproval ? 'Billing change sent for approval' : 'Billing responsibility changed'));
              if (r) onClose();
            }}
          >
            Submit
          </Button>
        </>
      }
    >
      <p className="mb-2 text-sm font-semibold text-navy">1. Select services</p>
      <div className="mb-4 max-h-52 overflow-y-auto rounded border border-slate-200">
        {services.map((s) => (
          <label key={s.id} className={clsx('flex items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-sm last:border-0', sel.includes(s.id) && 'bg-royal-50')}>
            <input type="checkbox" checked={sel.includes(s.id)} onChange={(e) => setSel(e.target.checked ? [...sel, s.id] : sel.filter((x) => x !== s.id))} />
            <span className="flex-1">{s.offeringName}</span>
            <span className="font-mono text-xs text-slate-500">currently {s.billingAccountId}</span>
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="2. New paying billing account" required>
          <Select label="Target billing account" value={target} onChange={setTarget} options={[{ value: '', label: 'Select…' }, ...targets.map((b) => ({ value: b.id, label: `${b.name} (${b.id})` }))]} />
        </Field>
        <Field label="3. Reason" required>
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Site now budgets its own connectivity" />
        </Field>
      </div>
      <div className="mt-3">
        <SimNote>Changing who pays is a controlled change. When the approval policy is on, the reassignment is applied only after a super administrator approves it.</SimNote>
      </div>
    </Modal>
  );
}
