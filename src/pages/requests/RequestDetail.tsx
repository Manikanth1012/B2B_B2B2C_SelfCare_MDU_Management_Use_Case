import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { Paperclip } from 'lucide-react';
import { advanceRequest, cancelRequest, commentRequest, currentUser, getRequest } from '../../api/api';
import type { RequestStatus } from '../../data/types';
import { useApi } from '../../lib/hooks';
import { date, dateTime } from '../../lib/format';
import { Button, Card, ConfirmDialog, ErrorState, inputCls, LinkButton, Loading, PageHeader, SimNote, Stat, StatusBadge, useAction } from '../../components/ui';

const FLOW: RequestStatus[] = ['Submitted', 'Validating', 'Approved', 'In Progress', 'Completed'];

export function RequestDetail() {
  const { id = '' } = useParams();
  const q = useApi(() => getRequest(id), [id]);
  const [comment, setComment] = useState('');
  const [file, setFile] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const { run, busy } = useAction();
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const r = q.data;
  const terminal = ['Rejected', 'Failed', 'Cancelled'].includes(r.status);
  const idx = FLOW.indexOf(r.status);
  const operator = currentUser().roleId === 'OPERATOR';
  const nextStatus = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
  const overdueSla = !['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(r.status) && r.slaDue < '2026-10-23';

  return (
    <div>
      <PageHeader
        title={r.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{r.id}</span> <StatusBadge status={r.status} /> <StatusBadge status={r.priority} /> {r.kind}
          </span>
        }
        crumbs={[{ label: 'Service Center', to: '/requests' }, { label: r.id }]}
        actions={
          <>
            {r.orderId && <LinkButton to={`/services/orders/${r.orderId}`}>Track order {r.orderId}</LinkButton>}
            {['Submitted', 'Validating'].includes(r.status) && (
              <Button variant="secondary" onClick={() => setCancelling(true)}>
                Cancel request
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-6">
        <ol className="flex flex-wrap items-center gap-y-3">
          {FLOW.map((s, i) => {
            const done = !terminal && idx >= i;
            return (
              <li key={s} className="flex items-center">
                <span className={clsx('flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold', done ? (i === idx ? 'bg-brand text-white' : 'bg-[#DFF3E8] text-[#13A538]') : 'bg-surface-100 text-ink-400')}>
                  {done && i < idx ? '✓' : i + 1} {s}
                </span>
                {i < FLOW.length - 1 && <span className={clsx('mx-1 h-0.5 w-6 sm:w-10', done && idx > i ? 'bg-[#13A538]' : 'bg-line-200')} />}
              </li>
            );
          })}
          {terminal && (
            <li className="ml-3">
              <StatusBadge status={r.status} />
            </li>
          )}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Details" className="lg:col-span-2">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Stat label="Request type">{r.category}</Stat>
            <Stat label="Related account / unit">{r.context}</Stat>
            <Stat label="Submitted">{dateTime(r.timeline[0]?.at)}</Stat>
            <Stat label="Submitted by">{r.createdByName}</Stat>
            <Stat label="Assigned team">{r.assignedTeam}</Stat>
            <Stat label="SLA / target date">
              <span className={overdueSla ? 'font-bold text-red-700' : ''}>
                {date(r.slaDue)}
                {overdueSla && ' · breached'}
              </span>
            </Stat>
            {r.appointment && (
              <Stat label="Appointment">
                {date(r.appointment.slot)} {r.appointment.window} · {r.appointment.technician} <StatusBadge status={r.appointment.status} />
              </Stat>
            )}
            {r.serviceId && (
              <Stat label="Service">
                <button className="text-royal hover:underline" onClick={() => nav(`/services/${r.serviceId}`)}>
                  {r.serviceId}
                </button>
              </Stat>
            )}
          </dl>
          <p className="mt-5 whitespace-pre-line rounded-xl bg-surface-50 p-4 text-sm text-ink-700">{r.description}</p>
          {r.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {r.attachments.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-3 py-1 text-xs font-semibold text-ink-700">
                  <Paperclip className="h-3 w-3" /> {a}
                </span>
              ))}
            </div>
          )}
        </Card>
        <Card title="Timeline">
          <ol className="relative ml-2 border-l-2 border-line-200">
            {r.timeline.map((t, i) => (
              <li key={i} className="mb-4 ml-4">
                <span className={clsx('absolute -left-[7px] mt-1 h-3 w-3 rounded-full', t.status === 'Comment' ? 'bg-royal' : 'bg-crimson')} />
                <p className="text-sm font-bold text-navy">{t.status === 'Comment' ? 'Comment' : t.status}</p>
                {t.note && <p className="text-sm text-ink-700">{t.note}</p>}
                <p className="text-[11px] text-ink-400">
                  {t.by} · {dateTime(t.at)}
                </p>
              </li>
            ))}
          </ol>
          {!terminal && r.status !== 'Completed' && (
            <div className="mt-2 border-t border-line-100 pt-3">
              <textarea className={clsx(inputCls, 'h-20 py-2')} placeholder="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} />
              <div className="mt-2 flex items-center justify-between gap-2">
                <label className="cursor-pointer text-xs font-bold text-royal">
                  <Paperclip className="mr-1 inline h-3.5 w-3.5" />
                  {file || 'Attach file'}
                  <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0]?.name ?? '')} />
                </label>
                <Button size="sm" loading={busy} disabled={!comment.trim() && !file} onClick={async () => (await run(() => commentRequest(r.id, comment, file || undefined), 'Comment added')) !== undefined && (setComment(''), setFile(''))}>
                  Post
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {operator && !terminal && r.status !== 'Completed' && (
        <Card title="Operator fulfilment (simulated)" className="mt-6">
          <div className="flex flex-wrap gap-2">
            {nextStatus && (
              <Button size="sm" onClick={() => run(() => advanceRequest(r.id, nextStatus), `Moved to ${nextStatus}`)}>
                Advance to {nextStatus}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => run(() => advanceRequest(r.id, 'Rejected', 'Rejected by operator'), 'Rejected')}>
              Reject
            </Button>
            <Button size="sm" variant="secondary" onClick={() => run(() => advanceRequest(r.id, 'Failed', 'Fulfilment failed'), 'Marked failed')}>
              Mark failed
            </Button>
          </div>
          <div className="mt-3">
            <SimNote>Visible only to the operator demo role. Completing an order activates its pending service; failing it terminates a pending installation.</SimNote>
          </div>
        </Card>
      )}
      <ConfirmDialog open={cancelling} title="Cancel request" body="Cancel this request? Any pending installation or change linked to it will be withdrawn." confirmLabel="Cancel request" danger loading={busy} onClose={() => setCancelling(false)} onConfirm={async () => (await run(() => cancelRequest(r.id), 'Request cancelled'), setCancelling(false))} />
    </div>
  );
}
