import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, User } from 'lucide-react';
import { can, currentUser, getProfile, getSettings, listBillingAccounts, updateAccount, updateMyContact, updateSettings } from '../../api/api';
import type { Settings } from '../../data/types';
import { useApi } from '../../lib/hooks';
import { Button, ErrorState, Field, inputCls, Loading, Modal, SimNote, Tabs, useAction } from '../../components/ui';
import { EditRow, SettingsShell } from './SettingsShell';

function ProfileHead({ name, id, email, phone }: { name: string; id: string; email: string; phone: string }) {
  return (
    <div className="mb-8 grid items-center gap-6 sm:grid-cols-[auto_1fr_1fr_1fr]">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-royal-50 text-royal-700">
        <User className="h-11 w-11" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-2xl font-semibold uppercase text-navy">{name}</p>
        <p className="text-sm text-ink-600">Customer Number</p>
        <p className="text-xl text-navy">{id}</p>
      </div>
      <div className="min-w-0">
        <p className="text-sm text-ink-600">Email</p>
        <p className="truncate text-lg text-navy">{email}</p>
      </div>
      <div className="min-w-0">
        <p className="text-sm text-ink-600">Contact Number</p>
        <p className="truncate text-lg text-navy">{phone || '—'}</p>
      </div>
    </div>
  );
}

type EditField = { label: string; value: string; save: (v: string) => Promise<unknown> } | null;

function EditModal({ field, onClose }: { field: NonNullable<EditField>; onClose: () => void }) {
  const [v, setV] = useState(field.value);
  const { run, busy } = useAction();
  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${field.label.toLowerCase()}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={async () => (await run(() => field.save(v), `${field.label} updated`)) !== undefined && onClose()}>
            Save
          </Button>
        </>
      }
    >
      <Field label={field.label}>
        <input className={inputCls} value={v} onChange={(e) => setV(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

/** Customer Settings — the signed-in user's own profile. */
export function Profile() {
  const q = useApi(getProfile);
  const [edit, setEdit] = useState<EditField>(null);
  const [pw, setPw] = useState(false);
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const u = q.data.user;
  return (
    <SettingsShell>
      <Tabs active="general" onChange={() => {}} tabs={[{ id: 'general', label: 'General Settings' }]} />
      <ProfileHead name={u.name} id={u.id} email={u.email} phone={u.phone} />
      <div className="mb-10 rounded-card border border-line-100">
        <EditRow label="Display name" value={u.name} action="Change Username" onAction={() => setEdit({ label: 'Display name', value: u.name, save: (v) => updateMyContact({ name: v }) })} />
        <EditRow label="Password" value="••••••••••" action="Change Password" onAction={() => setPw(true)} />
        <EditRow label="Role" value={`${q.data.role.name} · ${q.data.tenant.name}`} />
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-[26px] font-semibold text-navy">Payment Methods</h2>
        {can('billing.read') && (
          <button onClick={() => nav('/billing/preferences')} className="flex items-center text-[15px] font-bold text-royal-700">
            Manage Card <ChevronRight className="h-4 w-4 text-[#FF8A00]" />
          </button>
        )}
      </div>
      <PaymentSummary />
      {edit && <EditModal field={edit} onClose={() => setEdit(null)} />}
      {pw && (
        <Modal open onClose={() => setPw(false)} title="Change password" footer={<Button onClick={() => setPw(false)}>Close</Button>}>
          <SimNote>Authentication is handled by the operator’s identity provider. In this prototype no credentials are stored or collected, so password change is not simulated.</SimNote>
        </Modal>
      )}
    </SettingsShell>
  );
}

function PaymentSummary() {
  const q = useApi(() => (can('billing.read') ? listBillingAccounts({ includeResidents: true }) : Promise.resolve([])));
  const methods = [...new Set((q.data ?? []).map((b) => b.paymentMethod))];
  return <p className="mt-2 text-lg text-ink-700">{methods.length ? `${methods.join(', ')} on ${q.data!.length} billing account(s)` : 'No Cards Available'}</p>;
}

/** Account Settings — organisation details, billing info and communication preferences. */
export function AccountSettings() {
  const q = useApi(getProfile);
  const [tab, setTab] = useState('basic');
  const [edit, setEdit] = useState<EditField>(null);
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const { user, organisation: org, contacts } = q.data;
  const primary = contacts.find((c) => c.isPrimary);
  const policyEditable = ['ENT_SUPER', 'OPERATOR'].includes(user.roleId);
  return (
    <SettingsShell>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'basic', label: 'Basic Details' },
          { id: 'comms', label: 'Communication Preferences' },
          ...(policyEditable ? [{ id: 'policy', label: 'Approval Policy' }] : []),
        ]}
      />
      {tab === 'basic' && (
        <>
          <ProfileHead name={org?.name ?? q.data.tenant.name} id={org?.id ?? user.tenantId} email={primary?.email ?? user.email} phone={primary?.phone ?? user.phone} />
          <h3 className="mb-3 text-lg font-semibold text-navy">Billing Info</h3>
          <div className="rounded-card border border-line-100">
            <EditRow
              label="Billing Address"
              value={(org?.billingAddress ?? '—').toUpperCase()}
              action={org && can('account.edit') ? 'Edit' : undefined}
              onAction={() => org && setEdit({ label: 'Billing address', value: org.billingAddress ?? '', save: (v) => updateAccount(org.id, { billingAddress: v }) })}
            />
            <EditRow label="Registration Number" value={org?.registrationNo ?? '—'} />
          </div>
        </>
      )}
      {tab === 'comms' && (
        <div className="rounded-card border border-line-100">
          <EditRow label="Email" value={user.email} action="Edit" onAction={() => setEdit({ label: 'Email', value: user.email, save: (v) => updateMyContact({ email: v }) })} />
          <EditRow label="Contact Number" value={user.phone || '—'} action="Edit" onAction={() => setEdit({ label: 'Contact number', value: user.phone, save: (v) => updateMyContact({ phone: v }) })} />
        </div>
      )}
      {tab === 'policy' && <ApprovalPolicy />}
      {edit && <EditModal field={edit} onClose={() => setEdit(null)} />}
    </SettingsShell>
  );
}

function ApprovalPolicy() {
  const [s, setS] = useState<Settings>(getSettings());
  const { run, busy } = useAction();
  const rows: [keyof Settings, string, string][] = [
    ['approvalForChildAccount', 'Child account creation', 'New child accounts start as Pending Approval until a super administrator approves.'],
    ['approvalForBulkActivation', 'Bulk service activation', 'Bulk orders from property managers need operator approval before provisioning.'],
    ['approvalForBillingChange', 'Billing responsibility changes', 'Re-billing services to another account is held for approval.'],
  ];
  return (
    <div>
      <div className="rounded-card border border-line-100">
        {rows.map(([k, label, desc]) => (
          <label key={k} className="flex cursor-pointer items-center justify-between gap-4 border-b border-line-100 px-6 py-5 last:border-0">
            <span>
              <span className="block text-lg text-navy">{label}</span>
              <span className="block text-sm text-ink-600">{desc}</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-[#E31E43]" checked={s[k] as boolean} onChange={(e) => setS({ ...s, [k]: e.target.checked })} />
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-600">Moves of child accounts, sensitive data changes and property administrator grants always require approval.</p>
      <Button className="mt-5" loading={busy} onClick={() => run(() => updateSettings({ approvalForChildAccount: s.approvalForChildAccount, approvalForBulkActivation: s.approvalForBulkActivation, approvalForBillingChange: s.approvalForBillingChange }), 'Approval policy saved')}>
        Save policy
      </Button>
      <p className="mt-2 text-[11px] text-ink-400">Signed in as {currentUser().name}.</p>
    </div>
  );
}
