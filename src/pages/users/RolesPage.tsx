import { Fragment } from 'react';
import { Check, Minus } from 'lucide-react';
import { currentUser, roles } from '../../api/api';
import type { Permission } from '../../data/types';
import { Card, PageHeader } from '../../components/ui';

const GROUPS: { label: string; perms: [Permission, string][] }[] = [
  { label: 'Accounts', perms: [['account.read', 'View accounts'], ['account.create', 'Create child accounts'], ['account.edit', 'Edit accounts & contacts'], ['account.move', 'Move accounts (approval)']] },
  { label: 'MDU', perms: [['property.read', 'View properties'], ['property.create', 'Register properties'], ['unit.manage', 'Manage units & occupancy']] },
  { label: 'Services', perms: [['service.read', 'View services'], ['service.order', 'Order & change services'], ['service.bulk', 'Bulk activation']] },
  { label: 'Billing', perms: [['billing.read', 'View billing'], ['billing.manage', 'Manage billing preferences'], ['billing.pay', 'Make payments']] },
  { label: 'Administration', perms: [['request.create', 'Raise tickets'], ['user.manage', 'Manage users & delegation'], ['approval.decide', 'Decide approvals'], ['reports.read', 'Reports'], ['audit.read', 'Audit history']] },
];

export function RolesPage() {
  const all = roles();
  const mine = currentUser().roleId;
  return (
    <div>
      <PageHeader title="Roles & Permissions" subtitle="Permissions are enforced in the data-access layer and always combined with the user’s account, billing, property or unit scope." crumbs={[{ label: 'Admin' }, { label: 'Roles & permissions' }]} />
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {all.map((r) => (
          <Card key={r.id} className={r.id === mine ? 'ring-2 ring-crimson/40' : ''} title={r.name} actions={r.id === mine && <span className="rounded-full bg-crimson-50 px-3 py-0.5 text-xs font-bold text-crimson">Your role</span>}>
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
    </div>
  );
}
