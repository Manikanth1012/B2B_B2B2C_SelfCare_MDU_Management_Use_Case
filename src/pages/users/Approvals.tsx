import { useState } from 'react';
import clsx from 'clsx';
import { ClipboardCheck } from 'lucide-react';
import { decideApproval, listApprovals } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { dateTime } from '../../lib/format';
import { Button, ErrorState, Field, inputCls, Kpi, Loading, Modal, PageHeader, StatusBadge, Tabs, useAction } from '../../components/ui';

type A = Awaited<ReturnType<typeof listApprovals>>[number];

export function Approvals() {
  const q = useApi(listApprovals);
  const [tab, setTab] = useState('mine');
  const [deciding, setDeciding] = useState<{ a: A; approve: boolean } | null>(null);
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const mine = q.data.filter((a) => a.canDecide);
  const pending = q.data.filter((a) => a.status === 'Pending');
  const history = q.data.filter((a) => a.status !== 'Pending');
  const rows = tab === 'mine' ? mine : tab === 'pending' ? pending : history;
  return (
    <div>
      <PageHeader title="Approval Requests" subtitle="Sensitive operations — hierarchy moves, billing responsibility, bulk activation and property administrators — wait here for an authorised decision." crumbs={[{ label: 'Admin' }, { label: 'Approvals' }]} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Awaiting my decision" value={mine.length} tone="red" icon={<ClipboardCheck className="h-5 w-5" />} />
        <Kpi label="All pending" value={pending.length} tone="orange" icon={<ClipboardCheck className="h-5 w-5" />} />
        <Kpi label="Decided" value={history.length} tone="green" icon={<ClipboardCheck className="h-5 w-5" />} />
      </div>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'mine', label: 'Awaiting my decision', count: mine.length },
          { id: 'pending', label: 'All pending', count: pending.length },
          { id: 'history', label: 'Approval history', count: history.length },
        ]}
      />
      <div className="space-y-3">
        {rows.map((a) => (
          <div key={a.id} className="rounded-card border border-line-100 bg-white/95 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase text-ink-400">
                  {a.type} · <span className="font-mono">{a.id}</span>
                </p>
                <p className="mt-1 text-[15px] font-semibold text-navy">{a.summary}</p>
                <p className="mt-1 text-xs text-ink-600">
                  Requested by {a.requestedByName} · {dateTime(a.requestedAt)} · Decided by: {a.deciderRoles.join(' or ')}
                </p>
                {typeof a.payload.reason === 'string' && <p className="mt-2 rounded-lg bg-surface-50 px-3 py-2 text-sm text-ink-700">Reason: {a.payload.reason}</p>}
                {a.decidedByName && (
                  <p className="mt-2 text-xs text-ink-600">
                    {a.status} by {a.decidedByName} on {dateTime(a.decidedAt)} {a.decisionNote && `— “${a.decisionNote}”`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                {a.canDecide && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setDeciding({ a, approve: false })}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => setDeciding({ a, approve: true })}>
                      Approve
                    </Button>
                  </>
                )}
              </div>
            </div>
            {a.status === 'Pending' && !a.canDecide && <p className="mt-2 text-[11px] text-ink-400">Needs a decision from {a.deciderRoles.join(' or ')} with scope over the target. Requesters cannot approve their own requests.</p>}
          </div>
        ))}
        {!rows.length && <p className="rounded-md bg-[#D3EAF0] px-6 py-6 text-[15px] text-ink-700">No approvals here</p>}
      </div>
      {deciding && <DecisionModal {...deciding} onClose={() => setDeciding(null)} />}
    </div>
  );
}

function DecisionModal({ a, approve, onClose }: { a: A; approve: boolean; onClose: () => void }) {
  const [note, setNote] = useState('');
  const { run, busy } = useAction();
  return (
    <Modal
      open
      onClose={onClose}
      title={approve ? 'Approve request' : 'Reject request'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={approve ? 'primary' : 'danger'} loading={busy} disabled={!approve && !note.trim()} onClick={async () => (await run(() => decideApproval(a.id, approve, note), approve ? 'Approved and applied' : 'Rejected')) !== undefined && onClose()}>
            {approve ? 'Approve & apply' : 'Reject'}
          </Button>
        </>
      }
    >
      <p className="mb-2 text-sm font-semibold text-navy">{a.summary}</p>
      <p className={clsx('mb-3 rounded-lg p-3 text-sm', approve ? 'bg-amber-50 text-amber-900' : 'bg-surface-50 text-ink-700')}>
        {approve ? 'Approving applies the change immediately with today as the effective date, and is recorded in the audit history.' : 'The requester is notified and nothing changes.'}
      </p>
      <Field label={approve ? 'Note (optional)' : 'Reason for rejection'} required={!approve}>
        <textarea className={clsx(inputCls, 'h-20 py-2')} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
