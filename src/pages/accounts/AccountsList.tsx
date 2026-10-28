import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, GitBranch, MoreVertical, Plus, Users } from 'lucide-react';
import { can, listAccounts, listBillingAccounts, listRequests, toReporting, type AccountRow } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { money } from '../../lib/format';
import { Card, DataTable, ErrorState, Kpi, LinkButton, Loading, PageHeader, SearchBox, Select, StatusBadge, Tag } from '../../components/ui';
import { AccountEditModal } from './AccountEditModal';

async function load() {
  const [accounts, billing, requests] = await Promise.all([listAccounts(), can('billing.read') ? listBillingAccounts() : Promise.resolve([]), listRequests()]);
  return { accounts, billing, requests };
}

export function AccountsList() {
  const q = useApi(load);
  const nav = useNavigate();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('All types');
  const [status, setStatus] = useState('All statuses');
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const { accounts, billing, requests } = q.data;
  const rows = accounts.filter(
    (a) =>
      (type === 'All types' || a.type === type) &&
      (status === 'All statuses' || a.status === status) &&
      (!search || `${a.id} ${a.name} ${a.parentName ?? ''} ${a.primaryContact?.name ?? ''}`.toLowerCase().includes(search.toLowerCase())),
  );
  const outstanding = billing.reduce((a, b) => a + toReporting(b.balance, b.currency), 0);
  const accountIds = new Set(accounts.map((a) => a.id));
  const pending = requests.filter((r) => r.businessAccountId && accountIds.has(r.businessAccountId) && !['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(r.status)).length;

  return (
    <div>
      <PageHeader
        title="Business Accounts"
        subtitle="Corporate accounts, subsidiaries, departments and branches you are authorised to manage."
        crumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Business Accounts' }]}
        actions={
          <>
            <LinkButton to="/accounts/hierarchy" variant="secondary">
              <GitBranch className="h-4 w-4" /> Hierarchy
            </LinkButton>
            {can('account.create') && (
              <LinkButton to="/accounts/new" variant="primary">
                <Plus className="h-4 w-4" /> Create child account
              </LinkButton>
            )}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Total business accounts" value={accounts.length} />
        <Kpi label="Active child accounts" value={accounts.filter((a) => a.type !== 'Root' && a.status === 'Active').length} />
        <Kpi label="Total active services" value={accounts.reduce((n, a) => n + a.activeServices, 0)} tone="orange" to="/services" />
        <Kpi label="Outstanding balance" value={money(outstanding, 'USD', true)} to="/billing" />
        <Kpi label="Pending requests" value={pending} to="/requests" />
      </div>
      <Card>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_180px_180px]">
          <SearchBox value={search} onChange={setSearch} placeholder="Search by name, ID, parent or contact" />
          <Select label="Account type" value={type} onChange={setType} options={['All types', 'Root', 'Subsidiary', 'Department', 'Branch', 'Service']} />
          <Select label="Status" value={status} onChange={setStatus} options={['All statuses', 'Active', 'Pending Approval', 'Suspended', 'Closed']} />
        </div>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => nav(`/accounts/${r.id}`)}
          mobileTitle={(r) => r.name}
          columns={[
            { key: 'id', header: 'Account ID', render: (r) => <span className="font-mono text-xs">{r.id}</span>, sort: (r) => r.id },
            { key: 'name', header: 'Business name', render: (r) => <span className="font-semibold text-navy">{r.name}</span>, sort: (r) => r.name, mobileHidden: true },
            { key: 'type', header: 'Type', render: (r) => <Tag>{r.type}</Tag>, sort: (r) => r.type },
            { key: 'parent', header: 'Parent account', render: (r) => r.parentName ?? '—', sort: (r) => r.parentName ?? '' },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} />, sort: (r) => r.status },
            { key: 'contact', header: 'Primary contact', render: (r) => r.primaryContact?.name ?? '—' },
            { key: 'svc', header: 'Active services', render: (r) => r.activeServices, sort: (r) => r.activeServices, className: 'text-right' },
            { key: 'bill', header: 'Billing arrangement', render: (r) => <span className="text-xs text-slate-600">{r.billingArrangement}</span> },
            {
              key: 'act',
              header: 'Actions',
              mobileHidden: true,
              render: (r) => (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button aria-label={`Actions for ${r.name}`} className="rounded p-1 hover:bg-slate-100" onClick={() => setMenu(menu === r.id ? null : r.id)}>
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menu === r.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                      <div className="absolute right-0 z-20 w-48 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
                        <MenuItem onClick={() => nav(`/accounts/${r.id}`)}>View account</MenuItem>
                        {can('account.create') && <MenuItem onClick={() => nav(`/accounts/new?parent=${r.id}`)} icon={<Plus className="h-3.5 w-3.5" />}>Create child account</MenuItem>}
                        {can('account.edit') && <MenuItem onClick={() => (setEditing(r), setMenu(null))} icon={<Edit3 className="h-3.5 w-3.5" />}>Edit account</MenuItem>}
                        <MenuItem onClick={() => nav(`/accounts/hierarchy?focus=${r.id}`)} icon={<GitBranch className="h-3.5 w-3.5" />}>View hierarchy</MenuItem>
                        {can('user.manage') && <MenuItem onClick={() => nav(`/users?account=${r.id}`)} icon={<Users className="h-3.5 w-3.5" />}>Manage users</MenuItem>}
                      </div>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
      {editing && <AccountEditModal account={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MenuItem({ children, onClick, icon }: { children: React.ReactNode; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-royal-50">
      {icon}
      {children}
    </button>
  );
}
