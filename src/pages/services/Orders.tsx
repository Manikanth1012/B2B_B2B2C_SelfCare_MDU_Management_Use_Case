import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { listOrders } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date } from '../../lib/format';
import { Button, ErrorState, Loading, PageHeader, StatusBadge } from '../../components/ui';

const PAGE = 6;
const STATUS_TEXT: Record<string, string> = { Completed: 'text-[#13A538]', Failed: 'text-crimson', Rejected: 'text-crimson', Cancelled: 'text-ink-400' };

export function Orders() {
  const q = useApi(listOrders);
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const pages = Math.max(1, Math.ceil(q.data.length / PAGE));
  const view = q.data.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div>
      <PageHeader title="Orders" subtitle="Connection, change and bulk activation orders you are authorised to see." />
      <div className="space-y-4">
        {view.map((o) => (
          <div key={o.id} className="rounded-md border border-line-100 bg-white/90 backdrop-blur-sm">
            <button onClick={() => setOpen(open === o.id ? null : o.id)} aria-expanded={open === o.id} className="grid w-full grid-cols-2 gap-4 px-6 py-5 text-left md:grid-cols-[1.2fr_1fr_1fr_1fr_24px] md:px-14">
              <div>
                <p className="text-sm text-ink-700">Order ID:</p>
                <p className="text-lg font-semibold text-navy md:text-[22px]">{o.id}</p>
              </div>
              <div>
                <p className="text-sm text-ink-700">Order Type:</p>
                <p className="text-lg font-semibold text-navy md:text-[22px]">{o.kind}</p>
              </div>
              <div className="self-end">
                <p className="text-sm text-ink-700">Order Date:</p>
                <p className="font-semibold text-ink-600">{date(o.createdAt)}</p>
              </div>
              <div className="self-end">
                <p className="text-sm text-ink-700">Status:</p>
                <p className={clsx('font-bold', STATUS_TEXT[o.status] ?? 'text-[#FF8A00]')}>{o.status}</p>
              </div>
              <ChevronDown className={clsx('hidden h-6 w-6 self-center text-navy transition md:block', open === o.id && 'rotate-180')} />
            </button>
            {open === o.id && (
              <div className="border-t border-line-100 px-6 py-4 md:px-14">
                <p className="mb-3 text-sm text-ink-700">
                  {o.title} · {o.context} {o.appointment && `· ${o.appointment}`}
                </p>
                <ul className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {o.items.slice(0, 9).map((i, k) => (
                    <li key={k} className="flex items-center justify-between gap-2 rounded-xl bg-surface-50 px-3 py-2 text-sm">
                      <span className="truncate">{i.unitNumber ?? i.serviceId ?? '—'} · {i.offeringName ?? 'change'}</span>
                      <StatusBadge status={i.status} />
                    </li>
                  ))}
                </ul>
                {o.items.length > 9 && <p className="mb-3 text-xs text-ink-400">+ {o.items.length - 9} more items</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => nav(`/services/orders/${o.id}`)}>
                    Track order
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => nav(`/requests/${o.requestId}`)}>
                    View ticket
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!q.data.length && <p className="rounded-md bg-[#D3EAF0] px-6 py-6 text-[15px] text-ink-700">No orders yet</p>}
      </div>
      <div className="mt-8 flex justify-center gap-3">
        <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="h-12 w-16 rounded border border-line-200 bg-white text-lg text-ink-700 disabled:opacity-40" aria-label="Previous page">
          {'<<'}
        </button>
        {Array.from({ length: pages }, (_, i) => (
          <button key={i} onClick={() => setPage(i)} aria-current={page === i} className={clsx('h-12 w-11 rounded text-lg', page === i ? 'bg-gradient-to-b from-crimson to-plum text-white' : 'border border-line-200 bg-white text-ink-700')}>
            {i + 1}
          </button>
        ))}
        <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="h-12 w-16 rounded border border-line-200 bg-white text-lg text-ink-700 disabled:opacity-40" aria-label="Next page">
          {'>>'}
        </button>
      </div>
    </div>
  );
}
