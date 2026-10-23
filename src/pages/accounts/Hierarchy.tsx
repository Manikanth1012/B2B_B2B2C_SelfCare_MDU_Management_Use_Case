import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, CreditCard, FolderTree, List, Move, Plus, Wifi } from 'lucide-react';
import { can, getAccount, getHierarchy, moveProblem, requestMoveAccount, type HierarchyNode } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date, money } from '../../lib/format';
import { Button, Card, DataTable, Drawer, ErrorState, Field, inputCls, LinkButton, Loading, Modal, PageHeader, SearchBox, SimNote, Stat, StatusBadge, Tag, useAction } from '../../components/ui';

function flatten(nodes: HierarchyNode[], depth = 0, path: string[] = []): { node: HierarchyNode; depth: number; path: string[] }[] {
  return nodes.flatMap((n) => [{ node: n, depth, path }, ...flatten(n.children, depth + 1, [...path, n.account.id])]);
}

const TYPE_COLOUR: Record<string, string> = { Root: 'bg-navy text-white', Subsidiary: 'bg-brand text-white', Department: 'bg-teal-50 text-cyan-800', Branch: 'bg-royal-50 text-royal', Service: 'bg-slate-100 text-slate-700' };

export function Hierarchy() {
  const q = useApi(getHierarchy);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'tree' | 'list'>('tree');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const selected = params.get('focus');
  const [moving, setMoving] = useState<string | null>(null);
  const nav = useNavigate();

  const flat = useMemo(() => (q.data ? flatten(q.data) : []), [q.data]);
  const byId = useMemo(() => new Map(flat.map((f) => [f.node.account.id, f])), [flat]);
  const selectedPath = selected ? byId.get(selected)?.path ?? [] : [];

  // Search keeps matches plus their ancestors so context is never lost.
  const visibleIds = useMemo(() => {
    if (!search) return null;
    const s = search.toLowerCase();
    const ids = new Set<string>();
    flat.forEach((f) => {
      if (`${f.node.account.name} ${f.node.account.id} ${f.node.account.type}`.toLowerCase().includes(s)) {
        ids.add(f.node.account.id);
        f.path.forEach((p) => ids.add(p));
      }
    });
    return ids;
  }, [search, flat]);

  useEffect(() => {
    if (selected) setCollapsed((c) => new Set([...c].filter((id) => !(byId.get(selected)?.path ?? []).includes(id))));
  }, [selected, byId]);

  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;

  const toggle = (id: string) => setCollapsed((c) => (c.has(id) ? new Set([...c].filter((x) => x !== id)) : new Set([...c, id])));
  const select = (id: string | null) => setParams(id ? { focus: id } : {}, { replace: true });

  const renderNode = (n: HierarchyNode, depth: number): React.ReactNode => {
    const id = n.account.id;
    if (visibleIds && !visibleIds.has(id)) return null;
    const open = visibleIds ? true : !collapsed.has(id);
    const isSel = selected === id;
    const isAnc = selectedPath.includes(id);
    return (
      <li key={id} role="treeitem" aria-expanded={n.children.length ? open : undefined} aria-selected={isSel}>
        <div className={clsx('group flex items-center gap-1 rounded-md py-1 pr-2', isSel ? 'bg-crimson-50 ring-1 ring-crimson' : isAnc ? 'bg-amber-50' : 'hover:bg-slate-50')} style={{ paddingLeft: depth * 22 + 4 }}>
          {n.children.length ? (
            <button aria-label={open ? `Collapse ${n.account.name}` : `Expand ${n.account.name}`} onClick={() => toggle(id)} className="rounded p-0.5 text-slate-500 hover:bg-slate-200">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <button onClick={() => select(id)} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left">
            <span className={clsx('rounded px-1.5 py-0.5 text-[11px] font-bold', TYPE_COLOUR[n.account.type])}>{n.account.type}</span>
            <span className={clsx('font-semibold', search && n.account.name.toLowerCase().includes(search.toLowerCase()) ? 'bg-yellow-100 text-navy' : 'text-navy')}>{n.account.name}</span>
            <span className="font-mono text-[11px] text-slate-500">{id}</span>
            {n.account.status !== 'Active' && <StatusBadge status={n.account.status} />}
            <span className="ml-auto hidden items-center gap-3 text-[11px] text-slate-500 sm:flex">
              <span title="Active services incl. descendants" className="flex items-center gap-1">
                <Wifi className="h-3 w-3" />
                {n.aggregatedServices}
              </span>
              <span title="Descendant accounts">{n.descendantCount} sub-accounts</span>
            </span>
          </button>
          {can('account.create') && n.account.status === 'Active' && (
            <button title="Create child account" aria-label={`Create child under ${n.account.name}`} onClick={() => nav(`/accounts/new?parent=${id}`)} className="rounded p-1 text-royal opacity-0 hover:bg-royal-50 group-hover:opacity-100 focus:opacity-100">
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
        {open && n.billingLinks.length > 0 && (
          <div className="flex flex-wrap gap-1.5 py-0.5" style={{ paddingLeft: depth * 22 + 30 }}>
            {n.billingLinks.map((b) => (
              <button key={b.id} onClick={() => nav('/billing/hierarchy?focus=' + b.id)} className="inline-flex items-center gap-1 rounded border border-dashed border-orange-300 bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-orange-800 hover:bg-orange-100" title="Billing relationship (not an organisational child)">
                <CreditCard className="h-3 w-3" /> {b.name} · {b.type}
              </button>
            ))}
          </div>
        )}
        {open && n.children.length > 0 && <ul role="group">{n.children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div>
      <PageHeader
        title="Account Hierarchy"
        subtitle="Organisational ownership. Billing relationships are shown as linked entities (dashed), not as children."
        crumbs={[{ label: 'Business Accounts', to: '/accounts' }, { label: 'Hierarchy' }]}
        actions={
          <div className="flex rounded-full border border-line-200 bg-white p-1">
            <button onClick={() => setView('tree')} aria-pressed={view === 'tree'} className={clsx('flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold', view === 'tree' ? 'bg-brand text-white' : 'text-slate-600')}>
              <FolderTree className="h-4 w-4" /> Tree
            </button>
            <button onClick={() => setView('list')} aria-pressed={view === 'list'} className={clsx('flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold', view === 'list' ? 'bg-brand text-white' : 'text-slate-600')}>
              <List className="h-4 w-4" /> List
            </button>
          </div>
        }
      />
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <SearchBox value={search} onChange={setSearch} placeholder="Search accounts in hierarchy…" />
          </div>
          {view === 'tree' && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setCollapsed(new Set())}>
                Expand all
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setCollapsed(new Set(flat.filter((f) => f.node.children.length).map((f) => f.node.account.id)))}>
                Collapse all
              </Button>
            </>
          )}
        </div>
        <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-600">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-crimson-50 ring-1 ring-crimson" /> Selected
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-amber-50 ring-1 ring-amber-200" /> Ancestors of selection
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-dashed border-orange-300 bg-orange-50" /> Billing account link
          </span>
        </div>
        {view === 'tree' ? (
          <ul role="tree" aria-label="Account hierarchy" className="text-sm">
            {q.data.map((n) => renderNode(n, 0))}
            {visibleIds?.size === 0 && <p className="py-6 text-center text-sm text-slate-500">No accounts match “{search}”.</p>}
          </ul>
        ) : (
          <DataTable
            rows={flat.filter((f) => !visibleIds || visibleIds.has(f.node.account.id))}
            rowKey={(f) => f.node.account.id}
            onRowClick={(f) => select(f.node.account.id)}
            mobileTitle={(f) => f.node.account.name}
            pageSize={20}
            columns={[
              { key: 'name', header: 'Account', render: (f) => <span style={{ paddingLeft: f.depth * 14 }} className="font-semibold text-navy">{f.depth ? '└ ' : ''}{f.node.account.name}</span>, mobileHidden: true },
              { key: 'id', header: 'ID', render: (f) => <span className="font-mono text-xs">{f.node.account.id}</span> },
              { key: 'type', header: 'Type', render: (f) => <Tag>{f.node.account.type}</Tag> },
              { key: 'parent', header: 'Parent', render: (f) => f.node.account.parentName ?? '—' },
              { key: 'status', header: 'Status', render: (f) => <StatusBadge status={f.node.account.status} /> },
              { key: 'svc', header: 'Services (incl. children)', render: (f) => f.node.aggregatedServices },
              { key: 'bill', header: 'Billing links', render: (f) => f.node.billingLinks.map((b) => b.id).join(', ') || '—' },
            ]}
          />
        )}
      </Card>
      {selected && byId.get(selected) && <NodePanel id={selected} onClose={() => select(null)} onMove={() => setMoving(selected)} />}
      {moving && <MoveModal accountId={moving} flat={flat} onClose={() => setMoving(null)} />}
    </div>
  );
}

function NodePanel({ id, onClose, onMove }: { id: string; onClose: () => void; onMove: () => void }) {
  const q = useApi(() => getAccount(id), [id]);
  const nav = useNavigate();
  const d = q.data;
  return (
    <Drawer
      open
      onClose={onClose}
      title={d?.account.name ?? 'Loading…'}
      subtitle={d ? `${d.account.id} · ${d.account.type}` : undefined}
      footer={
        d && (
          <>
            <LinkButton to={`/accounts/${id}`} variant="primary" size="sm">
              Open account
            </LinkButton>
            {can('account.create') && d.account.status === 'Active' && (
              <LinkButton to={`/accounts/new?parent=${id}`} size="sm">
                <Plus className="h-4 w-4" /> Child account
              </LinkButton>
            )}
            {can('account.move') && d.account.type !== 'Root' && (
              <Button variant="secondary" size="sm" onClick={onMove}>
                <Move className="h-4 w-4" /> Move
              </Button>
            )}
          </>
        )
      }
    >
      {q.error && <ErrorState error={q.error} />}
      {!d ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          <nav aria-label="Ancestors" className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
            {d.ancestors.map((a) => (
              <span key={a.id} className="flex items-center gap-1">
                {a.visible ? (
                  <button className="hover:text-royal hover:underline" onClick={() => nav(`/accounts/hierarchy?focus=${a.id}`, { replace: true })}>
                    {a.name}
                  </button>
                ) : (
                  <span>{a.name}</span>
                )}
                <ChevronRight className="h-3 w-3" />
              </span>
            ))}
            <span className="font-semibold text-navy">{d.account.name}</span>
          </nav>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Status">
              <StatusBadge status={d.account.status} />
            </Stat>
            <Stat label="Created">{date(d.account.createdAt)}</Stat>
            <Stat label="Primary contact">{d.account.primaryContact?.name}</Stat>
            <Stat label="Direct children">{d.children.length}</Stat>
            <Stat label="Service address">{d.account.serviceAddress}</Stat>
            <Stat label="Registration">{d.account.registrationNo}</Stat>
          </dl>
          <div>
            <h3 className="mb-1.5 text-sm font-bold text-navy">Services at this account ({d.services.length})</h3>
            {d.services.length ? (
              <ul className="space-y-1 text-sm">
                {d.services.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded border border-slate-100 px-2 py-1">
                    <span className="truncate">{s.offeringName}</span>
                    <StatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No services directly on this account.</p>
            )}
          </div>
          <div>
            <h3 className="mb-1.5 text-sm font-bold text-navy">Billing relationships</h3>
            {d.billingAccounts.length ? (
              <ul className="space-y-1 text-sm">
                {d.billingAccounts.map((b) => (
                  <li key={b.id} className="rounded border border-dashed border-orange-200 bg-orange-50/50 px-2 py-1">
                    <div className="flex justify-between">
                      <span className="font-semibold">{b.name}</span>
                      <span>{money(b.balance, b.currency)}</span>
                    </div>
                    <p className="text-xs text-slate-600">{b.responsibility}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No visible billing relationships.</p>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function MoveModal({ accountId, flat, onClose }: { accountId: string; flat: { node: HierarchyNode; depth: number }[]; onClose: () => void }) {
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const { run, busy } = useAction();
  const account = flat.find((f) => f.node.account.id === accountId)!.node.account;
  const options = flat.map((f) => ({ id: f.node.account.id, name: f.node.account.name, depth: f.depth, problem: moveProblem(accountId, f.node.account.id) }));
  const submit = async () => {
    const r = await run(() => requestMoveAccount(accountId, target, reason), 'Move submitted for approval');
    if (r) onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Move ${account.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!target || !reason.trim()}>
            Submit for approval
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">Choose a new parent. Ineligible targets are disabled with the reason — moves that would create a cycle, cross organisations or break type rules are blocked.</p>
      <div className="mb-3 max-h-64 overflow-y-auto rounded-md border border-slate-200">
        {options.map((o) => (
          <label key={o.id} className={clsx('flex items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-sm last:border-0', o.problem ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer hover:bg-royal-50')} style={{ paddingLeft: 12 + o.depth * 16 }}>
            <input type="radio" name="target" disabled={!!o.problem} checked={target === o.id} onChange={() => setTarget(o.id)} />
            <span className="flex-1">{o.name}</span>
            {o.problem && <span className="text-[11px] italic">{o.problem}</span>}
          </label>
        ))}
      </div>
      <Field label="Business reason" required>
        <textarea className={clsx(inputCls, 'h-20 py-2')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Reorganisation under the India subsidiary from 1 Nov" />
      </Field>
      <div className="mt-3">
        <SimNote>Hierarchy moves are sensitive: the change is held as an approval request and applied with effective dating once approved by a super administrator.</SimNote>
      </div>
    </Modal>
  );
}
