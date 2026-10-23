import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Edit3, GitBranch, Plus, Repeat, Trash2 } from 'lucide-react';
import { can, describeScope, getAccount, removeContact, saveContact } from '../../api/api';
import type { Contact } from '../../data/types';
import { useApi } from '../../lib/hooks';
import { date, dateTime, money } from '../../lib/format';
import { Button, Card, ConfirmDialog, DataTable, ErrorState, Field, inputCls, LinkButton, Loading, Modal, PageHeader, Stat, StatusBadge, Tabs, Tag, useAction } from '../../components/ui';
import { AccountEditModal } from './AccountEditModal';
import { ReassignBillingModal } from '../billing/ReassignBillingModal';

export function AccountDetail() {
  const { id = '' } = useParams();
  const q = useApi(() => getAccount(id), [id]);
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [contact, setContact] = useState<Partial<Contact> | null>(null);
  const [removing, setRemoving] = useState<Contact | null>(null);
  const [rebill, setRebill] = useState(false);
  const nav = useNavigate();
  const { run, busy } = useAction();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const d = q.data;
  const a = d.account;

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {a.name} <Tag>{a.type}</Tag> <StatusBadge status={a.status} />
          </span>
        }
        subtitle={<span className="font-mono text-xs">{a.id}</span>}
        crumbs={[{ label: 'Business Accounts', to: '/accounts' }, ...d.ancestors.map((x) => ({ label: x.name, to: x.visible ? `/accounts/${x.id}` : undefined })), { label: a.name }]}
        actions={
          <>
            <LinkButton to={`/accounts/hierarchy?focus=${a.id}`}>
              <GitBranch className="h-4 w-4" /> Hierarchy
            </LinkButton>
            {can('account.edit') && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Edit3 className="h-4 w-4" /> Edit
              </Button>
            )}
            {can('account.create') && a.status === 'Active' && (
              <LinkButton to={`/accounts/new?parent=${a.id}`} variant="primary">
                <Plus className="h-4 w-4" /> Create child
              </LinkButton>
            )}
          </>
        }
      />
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'children', label: 'Child Accounts', count: d.children.length },
          { id: 'services', label: 'Services', count: d.services.length },
          { id: 'billing', label: 'Billing', count: d.billingAccounts.length },
          { id: 'contacts', label: 'Contacts & Users', count: d.contacts.length },
          { id: 'requests', label: 'Requests', count: d.requests.length },
          { id: 'history', label: 'Activity History' },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Account information" className="lg:col-span-2">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="Account ID">{a.id}</Stat>
              <Stat label="Account type">{a.type}</Stat>
              <Stat label="Status">
                <StatusBadge status={a.status} />
              </Stat>
              <Stat label="Parent account">{a.parentId ? a.parentName === 'Restricted' ? 'Restricted' : <Link className="text-royal hover:underline" to={`/accounts/${a.parentId}`}>{a.parentName}</Link> : 'None (root)'}</Stat>
              <Stat label="Registration number">{a.registrationNo}</Stat>
              <Stat label="Industry">{a.industry}</Stat>
              <Stat label="Service address">{a.serviceAddress}</Stat>
              <Stat label="Billing address">{a.billingAddress}</Stat>
              <Stat label="Created">{date(a.createdAt)}</Stat>
              <Stat label="Account owner">{a.accountOwner}</Stat>
            </dl>
          </Card>
          <Card title="Primary contact">
            {a.primaryContact ? (
              <dl className="space-y-3">
                <Stat label="Name">{a.primaryContact.name}</Stat>
                <Stat label="Title">{a.primaryContact.title}</Stat>
                <Stat label="Email">{a.primaryContact.email}</Stat>
                <Stat label="Phone">{a.primaryContact.phone}</Stat>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">No primary contact.</p>
            )}
          </Card>
          <Card title="At a glance" className="lg:col-span-3">
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <Stat label="Direct child accounts">{d.children.length}</Stat>
              <Stat label="Active services">{d.services.filter((s) => s.status === 'Active').length}</Stat>
              <Stat label="Monthly recurring">{money(d.services.filter((s) => s.status === 'Active').reduce((x, s) => x + s.mrc, 0), d.billingAccounts[0]?.currency)}</Stat>
              <Stat label="Open requests">{d.requests.filter((r) => !['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(r.status)).length}</Stat>
              <Stat label="Administrators">{d.admins.length}</Stat>
            </dl>
          </Card>
        </div>
      )}

      {tab === 'children' && (
        <Card title="Direct child accounts" actions={can('account.create') && a.status === 'Active' && <LinkButton size="sm" variant="primary" to={`/accounts/new?parent=${a.id}`}><Plus className="h-4 w-4" /> Add child</LinkButton>}>
          <DataTable
            rows={d.children}
            rowKey={(r) => r.id}
            onRowClick={(r) => nav(`/accounts/${r.id}`)}
            mobileTitle={(r) => r.name}
            empty="No child accounts in your scope."
            columns={[
              { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
              { key: 'name', header: 'Name', render: (r) => <span className="font-semibold">{r.name}</span>, mobileHidden: true },
              { key: 'type', header: 'Type', render: (r) => <Tag>{r.type}</Tag> },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'svc', header: 'Active services', render: (r) => r.activeServices },
              { key: 'kids', header: 'Children', render: (r) => r.childCount },
            ]}
          />
        </Card>
      )}

      {tab === 'services' && (
        <Card title="Services on this account" actions={can('service.order') && <LinkButton size="sm" variant="primary" to={`/services/new?account=${a.id}`}><Plus className="h-4 w-4" /> New service</LinkButton>}>
          <DataTable
            rows={d.services}
            rowKey={(r) => r.id}
            onRowClick={(r) => nav(`/services/${r.id}`)}
            mobileTitle={(r) => r.offeringName}
            empty="No services on this account. Services at child accounts appear on their own pages."
            columns={[
              { key: 'prod', header: 'Product', render: (r) => <span className="font-semibold">{r.offeringName}</span>, mobileHidden: true },
              { key: 'id', header: 'Service ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
              { key: 'cat', header: 'Category', render: (r) => r.category },
              { key: 'loc', header: 'Location', render: (r) => r.location },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'act', header: 'Activated', render: (r) => date(r.activationDate) },
              { key: 'bill', header: 'Billed to', render: (r) => <span className="font-mono text-xs">{r.billingAccountId}</span> },
            ]}
          />
        </Card>
      )}

      {tab === 'billing' && (
        <Card
          title="Linked billing accounts"
          actions={
            (can('billing.manage') || can('account.edit')) &&
            d.services.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setRebill(true)}>
                <Repeat className="h-4 w-4" /> Request billing reassignment
              </Button>
            )
          }
        >
          <p className="mb-3 text-sm text-slate-600">Service location does not imply billing responsibility: services delivered at this account may be billed to a parent's consolidated account.</p>
          <DataTable
            rows={d.billingAccounts}
            rowKey={(r) => r.id}
            onRowClick={() => nav('/billing/hierarchy')}
            mobileTitle={(r) => r.name}
            empty="No billing accounts visible for this account."
            columns={[
              { key: 'id', header: 'Billing account', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
              { key: 'name', header: 'Name', render: (r) => <span className="font-semibold">{r.name}</span>, mobileHidden: true },
              { key: 'type', header: 'Type', render: (r) => <Tag>{r.type}</Tag> },
              { key: 'resp', header: 'Responsibility', render: (r) => r.responsibility },
              { key: 'pay', header: 'Payment arrangement', render: (r) => `${r.paymentMethod} · cycle day ${r.billCycleDay}` },
              { key: 'bal', header: 'Outstanding', render: (r) => money(r.balance, r.currency), className: 'text-right' },
            ]}
          />
        </Card>
      )}

      {tab === 'contacts' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Contacts" actions={can('account.edit') && <Button size="sm" onClick={() => setContact({ accountId: a.id })}><Plus className="h-4 w-4" /> Add contact</Button>}>
            <ul className="divide-y divide-slate-100">
              {d.contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-navy">
                      {c.name} {c.isPrimary && <Tag className="ml-1">Primary</Tag>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.title} · {c.email} · {c.phone}
                    </p>
                  </div>
                  {can('account.edit') && (
                    <div className="flex gap-1">
                      <button aria-label={`Edit ${c.name}`} className="rounded p-1 hover:bg-slate-100" onClick={() => setContact(c)}>
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button aria-label={`Remove ${c.name}`} className="rounded p-1 text-red-600 hover:bg-red-50" onClick={() => setRemoving(c)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Authorised administrators" actions={can('user.manage') && <LinkButton size="sm" to={`/users?account=${a.id}&invite=1`}>Invite user</LinkButton>}>
            <ul className="divide-y divide-slate-100">
              {d.admins.map((u) => (
                <li key={u.id} className="py-2 text-sm">
                  <p className="font-semibold text-navy">
                    {u.name} <StatusBadge status={u.status} className="ml-1" />
                  </p>
                  <p className="text-xs text-slate-500">{u.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">Delegated scope: {u.scopes.map(describeScope).join('; ')}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'requests' && (
        <Card title="Requests" actions={can('request.create') && <LinkButton size="sm" variant="primary" to={`/requests/new?account=${a.id}`}>Raise request</LinkButton>}>
          <DataTable
            rows={d.requests}
            rowKey={(r) => r.id}
            onRowClick={(r) => nav(`/requests/${r.id}`)}
            mobileTitle={(r) => r.title}
            empty="No requests for this account."
            columns={[
              { key: 'id', header: 'Request', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
              { key: 't', header: 'Title', render: (r) => r.title, mobileHidden: true },
              { key: 'c', header: 'Category', render: (r) => r.category },
              { key: 'p', header: 'Priority', render: (r) => <StatusBadge status={r.priority} /> },
              { key: 's', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'd', header: 'Created', render: (r) => date(r.createdAt) },
            ]}
          />
        </Card>
      )}

      {tab === 'history' && (
        <Card title="Activity history">
          {d.history.length ? (
            <ol className="relative ml-2 border-l border-slate-200">
              {d.history.map((e) => (
                <li key={e.id} className="mb-4 ml-4">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-royal" />
                  <p className="text-sm font-semibold text-navy">{e.action}</p>
                  <p className="text-xs text-slate-600">{e.detail}</p>
                  <p className="text-[11px] text-slate-500">
                    {e.actor} · {dateTime(e.at)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">No recorded activity.</p>
          )}
        </Card>
      )}

      {editing && <AccountEditModal account={a} onClose={() => setEditing(false)} />}
      {contact && <ContactModal contact={contact} onClose={() => setContact(null)} />}
      {rebill && <ReassignBillingModal services={d.services} onClose={() => setRebill(false)} />}
      <ConfirmDialog
        open={!!removing}
        title="Remove contact"
        body={`Remove ${removing?.name} from ${a.name}? Their portal access (if any) is managed separately under Users & Access.`}
        confirmLabel="Remove"
        danger
        loading={busy}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          await run(() => removeContact(removing!.id), 'Contact removed');
          setRemoving(null);
        }}
      />
    </div>
  );
}

function ContactModal({ contact, onClose }: { contact: Partial<Contact>; onClose: () => void }) {
  const [f, setF] = useState({ name: '', title: '', email: '', phone: '', isPrimary: false, ...contact });
  const { run, busy } = useAction();
  return (
    <Modal
      open
      onClose={onClose}
      title={contact.id ? 'Edit contact' : 'Add contact'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!f.name || !f.email} onClick={async () => (await run(() => saveContact(f as Contact), 'Contact saved')) !== undefined && onClose()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Title">
          <input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Email" required>
          <input type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={!!f.isPrimary} onChange={(e) => setF({ ...f, isPrimary: e.target.checked })} /> Primary contact for this account
        </label>
      </div>
    </Modal>
  );
}
