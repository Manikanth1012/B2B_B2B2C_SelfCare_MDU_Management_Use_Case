import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { can, listAccounts, listContacts, listUsers } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { Card, DataTable, ErrorState, LinkButton, Loading, PageHeader, SearchBox, Tag } from '../../components/ui';

async function load() {
  const [contacts, accounts, users] = await Promise.all([listContacts(), listAccounts(), can('user.manage') ? listUsers() : Promise.resolve([])]);
  // Ancestor chain per account, to show administrators whose access is inherited from a parent.
  const ancestry: Record<string, string[]> = {};
  const parentOf = Object.fromEntries(accounts.map((a) => [a.id, a.parentId]));
  accounts.forEach((a) => {
    const chain: string[] = [];
    let p = parentOf[a.id];
    while (p && !chain.includes(p)) {
      chain.push(p);
      p = parentOf[p];
    }
    ancestry[a.id] = chain;
  });
  return { contacts, accounts, users, ancestry };
}

export function Contacts() {
  const q = useApi(load);
  const [search, setSearch] = useState('');
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const data = q.data;
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
        <Card title="Delegation by account" actions={can('user.manage') && <LinkButton size="sm" to="/users">Manage in Portal Users</LinkButton>}>
          <p className="mb-3 text-xs text-ink-600">Who can administer each account, and whether that access flows down to child accounts. User details and changes live in Portal Users.</p>
          <ul className="divide-y divide-line-100">
            {data.accounts.map((a) => {
              const admins = data.users.filter((u) => u.status !== 'Revoked' && u.scopes.some((g) => g.kind === 'account' && g.ref === a.id));
              const inherited = data.users.filter((u) => u.status !== 'Revoked' && !admins.includes(u) && u.scopes.some((g) => g.kind === 'account' && g.inherit && data.ancestry[a.id]?.includes(g.ref!)));
              return (
                <li key={a.id} className="py-2.5">
                  <button className="text-sm font-semibold text-navy hover:text-crimson" onClick={() => nav(`/accounts/${a.id}`)}>
                    {a.name}
                  </button>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {admins.map((u) => (
                      <Tag key={u.id}>{u.name}{u.scopes.find((g) => g.ref === a.id)?.inherit ? ' + children' : ''}</Tag>
                    ))}
                    {inherited.map((u) => (
                      <Tag key={u.id} className="bg-surface-100 text-ink-600">{u.name} (inherited)</Tag>
                    ))}
                    {!admins.length && !inherited.length && <span className="text-xs text-ink-400">No delegated administrator</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
