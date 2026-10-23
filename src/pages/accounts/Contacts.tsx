import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { can, listContacts, listUsers } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { Card, DataTable, ErrorState, LinkButton, Loading, PageHeader, SearchBox, StatusBadge, Tag } from '../../components/ui';

async function load() {
  const [contacts, users] = await Promise.all([listContacts(), can('user.manage') ? listUsers() : Promise.resolve([])]);
  return { contacts, users };
}

export function Contacts() {
  const q = useApi(load);
  const [search, setSearch] = useState('');
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const s = search.toLowerCase();
  const contacts = q.data.contacts.filter((c) => !s || `${c.name} ${c.email} ${c.accountName} ${c.title}`.toLowerCase().includes(s));
  return (
    <div>
      <PageHeader title="Contacts & Delegation" subtitle="Business contacts per account, and the portal administrators delegated to manage them." crumbs={[{ label: 'Business Accounts', to: '/accounts' }, { label: 'Contacts & Delegation' }]} actions={can('user.manage') && <LinkButton to="/users?invite=1" variant="primary">Delegate access</LinkButton>} />
      <div className="mb-3 max-w-md">
        <SearchBox value={search} onChange={setSearch} placeholder="Search contacts" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Account contacts (${contacts.length})`}>
          <DataTable
            rows={contacts}
            rowKey={(c) => c.id}
            onRowClick={(c) => nav(`/accounts/${c.accountId}`)}
            mobileTitle={(c) => c.name}
            columns={[
              { key: 'n', header: 'Name', render: (c) => <span className="font-semibold">{c.name} {c.isPrimary && <Tag className="ml-1">Primary</Tag>}</span>, mobileHidden: true, sort: (c) => c.name },
              { key: 'a', header: 'Account', render: (c) => c.accountName, sort: (c) => c.accountName },
              { key: 't', header: 'Title', render: (c) => c.title },
              { key: 'e', header: 'Email', render: (c) => <span className="text-xs">{c.email}</span> },
            ]}
          />
        </Card>
        {can('user.manage') && (
          <Card title="Delegated administrators">
            <DataTable
              rows={q.data.users.filter((u) => u.roleId !== 'RESIDENT')}
              rowKey={(u) => u.id}
              onRowClick={() => nav('/users')}
              mobileTitle={(u) => u.name}
              columns={[
                { key: 'n', header: 'User', render: (u) => <span className="font-semibold">{u.name}</span>, mobileHidden: true },
                { key: 'r', header: 'Role', render: (u) => u.roleName },
                { key: 's', header: 'Scope', render: (u) => <span className="text-xs">{u.scopeLabels.join('; ')}</span> },
                { key: 'st', header: 'Status', render: (u) => <StatusBadge status={u.status} /> },
              ]}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
