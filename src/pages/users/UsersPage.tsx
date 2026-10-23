import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { UserPlus } from 'lucide-react';
import { can, currentUser, describeScope, grantableRoles, grantableScopes, inviteUser, listUsers, setUserStatus, updateUserAccess } from '../../api/api';
import type { RoleId, Scope, User } from '../../data/types';
import { useApi } from '../../lib/hooks';
import { dateTime } from '../../lib/format';
import { Button, ConfirmDialog, DataTable, ErrorState, Field, inputCls, Kpi, Loading, Modal, PageHeader, SearchBox, SimNote, StatusBadge, useAction } from '../../components/ui';

export function UsersPage() {
  const q = useApi(listUsers);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [inviting, setInviting] = useState(params.get('invite') === '1');
  const [editing, setEditing] = useState<User | null>(null);
  const [revoking, setRevoking] = useState<User | null>(null);
  const { run, busy } = useAction();
  const accountFilter = params.get('account');
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const me = currentUser();
  const rows = q.data.filter((u) => (!accountFilter || u.scopes.some((g) => g.ref === accountFilter)) && (!search || `${u.name} ${u.email} ${u.roleName}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <div>
      <PageHeader
        title="Portal Users"
        subtitle="Invite users, assign roles and delegate account, billing or property scope. You can only grant what you hold."
        crumbs={[{ label: 'Admin' }, { label: 'Users' }]}
        actions={
          can('user.manage') && (
            <Button onClick={() => setInviting(true)}>
              <UserPlus className="h-4 w-4" /> Invite user
            </Button>
          )
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Active users" value={q.data.filter((u) => u.status === 'Active').length} tone="green" />
        <Kpi label="Invited (pending)" value={q.data.filter((u) => u.status === 'Invited').length} tone="orange" />
        <Kpi label="Revoked" value={q.data.filter((u) => u.status === 'Revoked').length} tone="red" />
      </div>
      {accountFilter && (
        <p className="mb-3 text-sm text-ink-700">
          Showing users with scope on <b>{accountFilter}</b>.{' '}
          <button className="font-bold text-royal hover:underline" onClick={() => setParams({})}>
            Show all
          </button>
        </p>
      )}
      <div className="mb-4 flex justify-end">
        <div className="w-72">
          <SearchBox value={search} onChange={setSearch} placeholder="Search users" />
        </div>
      </div>
      <DataTable
        rows={rows}
        rowKey={(u) => u.id}
        mobileTitle={(u) => u.name}
        columns={[
          { key: 'n', header: 'User', render: (u) => <span><span className="font-semibold text-navy">{u.name}</span><span className="block text-xs text-ink-400">{u.email}</span></span>, sort: (u) => u.name, mobileHidden: true },
          { key: 'r', header: 'Role', render: (u) => u.roleName, sort: (u) => u.roleName },
          { key: 's', header: 'Scope', render: (u) => <span className="text-xs">{u.scopeLabels.join('; ')}</span> },
          { key: 'l', header: 'Last login', render: (u) => (u.lastLogin ? dateTime(u.lastLogin) : '—') },
          { key: 'st', header: 'Status', render: (u) => <StatusBadge status={u.status} /> },
          {
            key: 'a',
            header: 'Actions',
            mobileHidden: true,
            render: (u) =>
              u.id === me.id ? (
                <span className="text-xs text-ink-400">You</span>
              ) : (
                <span className="flex gap-3 text-xs font-bold">
                  {u.status !== 'Revoked' && (
                    <button className="text-royal hover:underline" onClick={() => setEditing(u)}>
                      Edit access
                    </button>
                  )}
                  {u.status === 'Revoked' ? (
                    <button className="text-royal hover:underline" onClick={() => run(() => setUserStatus(u.id, 'Active'), 'Access restored')}>
                      Restore
                    </button>
                  ) : (
                    <button className="text-crimson hover:underline" onClick={() => setRevoking(u)}>
                      Revoke
                    </button>
                  )}
                </span>
              ),
          },
        ]}
      />
      {inviting && <AccessModal onClose={() => (setInviting(false), params.delete('invite'))} presetAccount={accountFilter ?? undefined} />}
      {editing && <AccessModal user={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!revoking}
        title="Revoke access"
        danger
        loading={busy}
        confirmLabel="Revoke access"
        body={
          <>
            Revoke portal access for <b>{revoking?.name}</b>? They are signed out immediately and lose all delegated scope ({revoking?.scopes.map(describeScope).join('; ')}). Accounts, services and billing are not affected.
          </>
        }
        onClose={() => setRevoking(null)}
        onConfirm={async () => (await run(() => setUserStatus(revoking!.id, 'Revoked'), 'Access revoked'), setRevoking(null))}
      />
    </div>
  );
}

function AccessModal({ user, onClose, presetAccount }: { user?: User; onClose: () => void; presetAccount?: string }) {
  const roles = grantableRoles();
  const scopes = grantableScopes();
  const [f, setF] = useState({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', title: user?.title ?? '', roleId: (user?.roleId ?? roles[0]?.id) as RoleId });
  const [sel, setSel] = useState<Scope[]>(user?.scopes ?? (presetAccount ? [{ kind: 'account', ref: presetAccount, inherit: true }] : []));
  const { run, busy } = useAction();
  useEffect(() => {
    if (!roles.length) onClose();
  }, [roles.length, onClose]);
  const has = (g: Scope) => sel.find((x) => x.kind === g.kind && x.ref === g.ref);
  const toggle = (g: Scope) => setSel(has(g) ? sel.filter((x) => !(x.kind === g.kind && x.ref === g.ref)) : [...sel, g]);
  const save = async () => {
    const ok = user ? await run(() => updateUserAccess(user.id, f.roleId, sel), 'Access updated') : await run(() => inviteUser({ ...f, scopes: sel }), (r) => (r.pendingApproval ? 'Invitation sent; property administration awaits operator approval' : 'Invitation sent (simulated email)'));
    if (ok !== undefined) onClose();
  };
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={user ? `Edit access – ${user.name}` : 'Invite user'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!sel.length || (!user && (!f.name || !f.email))} onClick={save}>
            {user ? 'Save access' : 'Send invitation'}
          </Button>
        </>
      }
    >
      {!user && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Field label="Full name" required>
            <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <input className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Job title">
            <input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
        </div>
      )}
      <Field label="Role" hint="Only roles whose permissions are within your own are offered">
        <select className={inputCls} value={f.roleId} onChange={(e) => setF({ ...f, roleId: e.target.value as RoleId })}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
      <p className="mb-2 mt-4 text-sm font-medium text-ink-600">Scope (subtree access includes future child accounts when “inherit” is on)</p>
      <div className="max-h-64 overflow-y-auto rounded-xl border border-line-200">
        {scopes.map((g) => {
          const cur = has(g);
          return (
            <div key={g.kind + g.ref} className={clsx('flex items-center gap-3 border-b border-line-100 px-3 py-2 text-sm last:border-0', cur && 'bg-crimson-50')}>
              <input type="checkbox" checked={!!cur} onChange={() => toggle(g)} aria-label={describeScope({ ...g, inherit: false })} />
              <span className="w-20 text-xs font-bold uppercase text-ink-400">{g.kind}</span>
              <span className="flex-1">{describeScope({ ...g, inherit: false })}</span>
              {cur && g.kind !== 'unit' && (
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={cur.inherit} onChange={(e) => setSel(sel.map((x) => (x === cur ? { ...x, inherit: e.target.checked } : x)))} /> inherit
                </label>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <SimNote>Property administrator grants are sensitive and are routed to the operator for approval. Invitations are simulated — no email is sent.</SimNote>
      </div>
    </Modal>
  );
}
