import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { listAppointments, rescheduleAppointment } from '../../api/api';
import { TODAY } from '../../data/seed';
import { useApi } from '../../lib/hooks';
import { date } from '../../lib/format';
import { Button, ErrorState, Field, inputCls, Kpi, Loading, Modal, PageHeader, Select, StatusBadge, useAction } from '../../components/ui';

export function Appointments() {
  const q = useApi(listAppointments);
  const [editing, setEditing] = useState<{ id: string; slot: string; window: string } | null>(null);
  const { run, busy } = useAction();
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const upcoming = q.data.filter((a) => (a.status === 'Scheduled' || a.status === 'Rescheduled') && a.slot >= TODAY);
  const past = q.data.filter((a) => !upcoming.includes(a));
  return (
    <div>
      <PageHeader title="Appointments" subtitle="Installation and field visits linked to your requests." crumbs={[{ label: 'Service Center', to: '/requests' }, { label: 'Appointments' }]} />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Upcoming" value={upcoming.length} tone="orange" icon={<CalendarClock className="h-5 w-5" />} />
        <Kpi label="Next 7 days" value={upcoming.filter((a) => a.slot <= '2026-10-30').length} icon={<CalendarClock className="h-5 w-5" />} />
        <Kpi label="Completed / cancelled" value={past.length} tone="green" icon={<CalendarClock className="h-5 w-5" />} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {upcoming.map((a) => (
          <div key={a.id} className="rounded-card border border-line-100 bg-white/95 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-bold text-navy">{date(a.slot)}</p>
                <p className="text-sm text-ink-600">{a.window}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <p className="mt-3 text-sm font-semibold text-navy">{a.request.title}</p>
            <p className="text-xs text-ink-600">
              {a.propertyName ?? a.request.context} {a.unitNumber && `· ${a.unitNumber}`} · Technician: {a.technician}
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditing({ id: a.id, slot: a.slot, window: a.window })}>
                Reschedule
              </Button>
              <Button size="sm" variant="ghost" onClick={() => nav(`/requests/${a.requestId}`)}>
                View ticket
              </Button>
            </div>
          </div>
        ))}
        {!upcoming.length && <p className="rounded-md bg-[#D3EAF0] px-6 py-6 text-[15px] text-ink-700 md:col-span-2 xl:col-span-3">No upcoming appointments</p>}
      </div>
      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title="Reschedule appointment"
          footer={
            <>
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button loading={busy} onClick={async () => (await run(() => rescheduleAppointment(editing.id, editing.slot, editing.window), 'Appointment rescheduled')) !== undefined && setEditing(null)}>
                Save
              </Button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date" hint="Mon–Sat only">
              <input type="date" min={TODAY} className={inputCls} value={editing.slot} onChange={(e) => setEditing({ ...editing, slot: e.target.value })} />
            </Field>
            <Field label="Window">
              <Select label="Window" value={editing.window} onChange={(v) => setEditing({ ...editing, window: v })} options={['09:00–12:00', '12:00–15:00', '15:00–18:00', '10:00–17:00']} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
