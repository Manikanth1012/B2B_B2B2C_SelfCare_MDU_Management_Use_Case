import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown, Eye, FileText } from 'lucide-react';
import { can, listRequests } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { dateTime } from '../../lib/format';
import { DataTable, ErrorState, Kpi, LinkButton, Loading, PageHeader, SearchBox, Select, StatusBadge } from '../../components/ui';
import { BlushPanel } from '../../components/template';

const CLOSED = ['Completed', 'Rejected', 'Cancelled', 'Failed'];
const OPEN = ['Submitted', 'Validating', 'Approved'];

const FAQ = [
  { q: 'How long does a new FTTH connection take?', a: 'Once availability passes and the order is approved, installation is scheduled within 3–7 working days. Track progress on the ticket timeline.' },
  { q: 'Why can’t I order for a “Network Not Ready” unit?', a: 'Activation is blocked until the fibre riser/drop reaches the unit. Raise a Property Connectivity Issue to schedule the network build.' },
  { q: 'Who approves bulk activations?', a: 'Bulk activations are approved by the operator. Account moves and billing-responsibility changes are approved by your enterprise super administrator.' },
  { q: 'Does changing an occupant change billing?', a: 'No. Occupancy and billing responsibility are separate; billing only changes through an explicit, approved request.' },
];

export function RequestsList() {
  const q = useApi(listRequests);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState(params.get('category') ?? 'All categories');
  const bucket = params.get('bucket') ?? 'all';
  const kind = params.get('kind');
  const [faq, setFaq] = useState<number | null>(null);
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const base = q.data.filter((r) => !kind || r.kind === kind);
  const counts = { open: base.filter((r) => OPEN.includes(r.status)).length, progress: base.filter((r) => r.status === 'In Progress').length, closed: base.filter((r) => CLOSED.includes(r.status)).length, all: base.length };
  const rows = base.filter(
    (r) =>
      (bucket === 'all' || (bucket === 'open' && OPEN.includes(r.status)) || (bucket === 'progress' && r.status === 'In Progress') || (bucket === 'closed' && CLOSED.includes(r.status))) &&
      (cat === 'All categories' || r.category === cat) &&
      (!search || `${r.id} ${r.title} ${r.context}`.toLowerCase().includes(search.toLowerCase())),
  );
  const setBucket = (b: string) => {
    const p = new URLSearchParams(params);
    p.set('bucket', b);
    setParams(p, { replace: true });
  };
  const tiles: { id: string; label: string; n: number; tone: 'red' | 'orange' | 'green' | 'default' }[] = [
    { id: 'open', label: 'Open Tickets', n: counts.open, tone: 'red' },
    { id: 'progress', label: 'In progress', n: counts.progress, tone: 'orange' },
    { id: 'closed', label: 'Closed', n: counts.closed, tone: 'green' },
    { id: 'all', label: 'All Tickets', n: counts.all, tone: 'default' },
  ];
  return (
    <div>
      <PageHeader title={kind === 'Incident' ? 'Service Center · Incidents' : kind === 'Service Request' ? 'Service Center · Service Requests' : 'Service Center'} />
      <BlushPanel title="Tickets History">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => (
            <button key={t.id} onClick={() => setBucket(t.id)} className="text-left" aria-pressed={bucket === t.id}>
              <Kpi label={t.label} value={t.n} tone={t.tone} active={bucket === t.id} icon={<FileText className="h-5 w-5" />} />
            </button>
          ))}
        </div>
      </BlushPanel>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line-200 pb-4">
        <h2 className="text-lg font-bold text-navy">
          {tiles.find((t) => t.id === bucket)?.label ?? 'All Tickets'} | {rows.length}
        </h2>
        {can('request.create') && (
          <LinkButton to="/requests/new" variant="primary">
            Create Ticket
          </LinkButton>
        )}
      </div>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Select label="Category" value={cat} onChange={setCat} options={['All categories', 'New Connection', 'Plan Change', 'Service Suspension', 'Billing Query', 'Network Issue', 'Property Connectivity Issue', 'Account Modification', 'Bulk Activation']} className="w-60" />
        <div className="w-64">
          <SearchBox value={search} onChange={setSearch} placeholder="Search" />
        </div>
      </div>
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(r) => nav(`/requests/${r.id}`)}
        mobileTitle={(r) => r.title}
        empty="No Tickets yet"
        columns={[
          { key: 'id', header: 'Ticket ID', render: (r) => <span className="font-mono text-xs">{r.id}</span>, sort: (r) => r.id },
          { key: 'd', header: 'Created Date & Time', render: (r) => dateTime(r.timeline[0]?.at ?? r.createdAt), sort: (r) => r.createdAt },
          { key: 's', header: 'Subject', render: (r) => <span className="font-medium text-navy">{r.title}</span>, mobileHidden: true },
          { key: 'c', header: 'Related to', render: (r) => <span className="text-xs">{r.context}</span> },
          { key: 'cat', header: 'Category', render: (r) => r.category },
          { key: 'st', header: 'Status', render: (r) => <StatusBadge status={r.status} />, sort: (r) => r.status },
          {
            key: 'v',
            header: 'View',
            mobileHidden: true,
            render: (r) => (
              <Link to={`/requests/${r.id}`} aria-label={`View ${r.id}`} className="inline-flex text-royal hover:text-crimson" onClick={(e) => e.stopPropagation()}>
                <Eye className="h-5 w-5" />
              </Link>
            ),
          },
        ]}
      />

      <h2 className="mb-3 mt-10 border-b border-line-200 pb-3 text-lg font-bold text-navy">FAQ</h2>
      <div className="divide-y divide-line-100 rounded-card border border-line-100 bg-white/95">
        {FAQ.map((f, i) => (
          <div key={f.q}>
            <button onClick={() => setFaq(faq === i ? null : i)} aria-expanded={faq === i} className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left text-[15px] font-semibold text-navy">
              {f.q}
              <ChevronDown className={clsx('h-5 w-5 shrink-0 transition', faq === i && 'rotate-180')} />
            </button>
            {faq === i && <p className="px-6 pb-4 text-sm text-ink-700">{f.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
