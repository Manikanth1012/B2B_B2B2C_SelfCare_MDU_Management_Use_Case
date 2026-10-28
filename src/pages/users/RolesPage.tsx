import { Fragment, useState } from 'react';
import { Check, Minus, Pencil, Plus } from 'lucide-react';
import { createRole, currentUser, grantableRoles, roles, updateRole } from '../../api/api';
import type { Permission, Role } from '../../data/types';
import { Button, Card, Field, inputCls, Modal, PageHeader, SimNote, useAction } from '../../components/ui';

const GROUPS: { label: string; perms: [Permission, string][] }[] = [
  { label: 'Accounts', perms: [['account.read', 'View accounts'], ['account.create', 'Create child accounts'], ['account.edit', 'Edit accounts & contacts'], ['account.move', 'Move accounts (approval)']] },
  { label: 'MDU', perms: [['property.read', 'View properties'], ['property.create', 'Register properties'], ['unit.manage', 'Manage units & occupancy']] },
  { label: 'Services', perms: [['service.read', 'View services'], ['service.order', 'Order & change services'], ['service.bulk', 'Bulk activation']] },
  { label: 'Billing', perms: [['billing.read', 'View billing'], ['billing.manage', 'Manage billing preferences'], ['billing.pay', 'Make payments']] },
  { label: 'Administration', perms: [['request.create', 'Raise tickets'], ['user.manage', 'Manage users & delegation'], ['approval.decide', 'Decide approvals'], ['reports.read', 'Reports'], ['audit.read', 'Audit history']] },
];

const ALL_PERMS = GROUPS.flatMap((g) => g.perms.map(([p]) => p));
const LOCKED = ['OPERATOR', 'RESIDENT'];

export function RolesPage() {
  const me = currentUser();
  const mine = me.roleId;
  const isOperator = mine === 'OPERATOR';
  const allRoles = roles();
  const grantable = grantableRoles();
  const visible = new Set([mine, ...grantable.map((r) => r.id)]);
  const all = allRoles.filter((r) => visible.has(r.id));
  const [editing, setEditing] = useState<Role | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Permissions are enforced in the data-access layer and always combined with the user's account, billing, property or unit scope."
        crumbs={[{ label: 'Admin' }, { label: 'Roles & permissions' }]}
        actions={
          isOperator && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add role
            </Button>
          )
        }
      />
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {all.map((r) => (
          <Card
            key={r.id}
            className={r.id === mine ? 'ring-2 ring-crimson/40' : ''}
            title={r.name}
            actions={
              <span className="flex items-center gap-2">
                {r.id === mine && <span className="rounded-full bg-crimson-50 px-3 py-0.5 text-xs font-bold text-crimson">Your role</span>}
                {isOperator && !LOCKED.includes(r.id) && (
                  <button onClick={() => setEditing(r)} className="rounded-lg p-1 text-ink-400 hover:bg-surface-100 hover:text-navy" title="Edit role">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </span>
            }
          >
            <p className="text-sm text-ink-700">{r.description}</p>
          </Card>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border border-line-100 bg-white/95">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand text-white">
              <th className="px-4 py-3.5 text-left font-bold">Permission</th>
              {all.map((r) => (
                <th key={r.id} className="px-3 py-3.5 text-center text-xs font-bold">
                  {r.name.replace(' Administrator', ' Admin')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => (
              <Fragment key={g.label}>
                <tr className="bg-surface-50">
                  <td colSpan={all.length + 1} className="px-4 py-2 text-xs font-bold uppercase text-ink-400">
                    {g.label}
                  </td>
                </tr>
                {g.perms.map(([p, label]) => (
                  <tr key={p} className="border-b border-line-100">
                    <td className="px-4 py-2 text-ink-700">{label}</td>
                    {all.map((r) => (
                      <td key={r.id} className="px-3 py-2 text-center">
                        {r.permissions.includes(p) ? <Check className="mx-auto h-4 w-4 text-[#13A538]" aria-label="Allowed" /> : <Minus className="mx-auto h-4 w-4 text-ink-400" aria-label="Not allowed" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {adding && <RoleModal onClose={() => setAdding(false)} />}
      {editing && <RoleModal role={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RoleModal({ role, onClose }: { role?: Role; onClose: () => void }) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [perms, setPerms] = useState<Set<Permission>>(new Set(role?.permissions ?? []));
  const { run, busy } = useAction();

  const toggle = (p: Permission) => {
    const next = new Set(perms);
    next.has(p) ? next.delete(p) : next.add(p);
    setPerms(next);
  };

  const save = async () => {
    const permissions = ALL_PERMS.filter((p) => perms.has(p));
    const ok = role
      ? await run(() => updateRole(role.id, { name, description, permissions }), 'Role updated')
      : await run(() => createRole({ name, description, permissions }), 'Role created');
    if (ok !== undefined) onClose();
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={role ? `Edit role – ${role.name}` : 'Add new role'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={!name.trim() || perms.size === 0} onClick={save}>
            {role ? 'Save changes' : 'Create role'}
          </Button>
        </>
      }
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Field label="Role name" required>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Field Technician" />
        </Field>
        <Field label="Description">
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this role's responsibilities" />
        </Field>
      </div>
      <p className="mb-2 text-sm font-medium text-ink-600">Permissions</p>
      <div className="rounded-xl border border-line-200">
        {GROUPS.map((g, gi) => (
          <div key={g.label} className={gi > 0 ? 'border-t border-line-100' : ''}>
            <div className="bg-surface-50 px-4 py-2 text-xs font-bold uppercase text-ink-400">{g.label}</div>
            {g.perms.map(([p, label]) => (
              <label key={p} className="flex cursor-pointer items-center gap-3 border-t border-line-100 px-4 py-2.5 text-sm hover:bg-surface-50">
                <input type="checkbox" checked={perms.has(p)} onChange={() => toggle(p)} className="h-4 w-4 accent-crimson" />
                <span className="text-ink-700">{label}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3">
        <SimNote>Role changes take effect immediately. Users assigned this role will see updated access on their next action.</SimNote>
      </div>
    </Modal>
  );
}
