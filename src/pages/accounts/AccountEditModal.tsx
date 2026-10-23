import { useState } from 'react';
import { updateAccount } from '../../api/api';
import type { BusinessAccount } from '../../data/types';
import { Button, Field, inputCls, Modal, useAction } from '../../components/ui';

export function AccountEditModal({ account, onClose }: { account: BusinessAccount; onClose: () => void }) {
  const [f, setF] = useState({ name: account.name, industry: account.industry ?? '', serviceAddress: account.serviceAddress ?? '', billingAddress: account.billingAddress ?? '', registrationNo: account.registrationNo ?? '' });
  const { run, busy } = useAction();
  const save = async () => {
    const r = await run(() => updateAccount(account.id, { ...f, registrationNo: f.registrationNo || undefined }), (x) => (x.pendingApproval ? 'Saved. Registration number change sent for approval.' : 'Account updated'));
    if (r) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${account.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} disabled={!f.name.trim()}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Account name" required error={!f.name.trim() ? 'Required' : undefined}>
          <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Industry / business type">
          <input className={inputCls} value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} />
        </Field>
        <Field label="Registration number" hint="Sensitive field — changes require approval by a super administrator.">
          <input className={inputCls} value={f.registrationNo} onChange={(e) => setF({ ...f, registrationNo: e.target.value })} />
        </Field>
        <Field label="Service address">
          <input className={inputCls} value={f.serviceAddress} onChange={(e) => setF({ ...f, serviceAddress: e.target.value })} />
        </Field>
        <Field label="Billing address">
          <input className={inputCls} value={f.billingAddress} onChange={(e) => setF({ ...f, billingAddress: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
