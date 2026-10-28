import { useNavigate } from 'react-router-dom';
import { Building2, CalendarClock, Home, LifeBuoy, Megaphone, Phone, Router, ShieldCheck } from 'lucide-react';
import { getMyHome } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date, dateTime } from '../../lib/format';
import { Card, ErrorState, LinkButton, Loading, PageHeader, Stat, StatusBadge } from '../../components/ui';
import { KycBadge } from './OccupantOnboarding';

/**
 * Resident "My Home": everything about the dwelling. The account-level
 * view (all services, bills, offers) is the Dashboard; nothing is repeated here.
 */
export function MyHome() {
  const q = useApi(getMyHome);
  const nav = useNavigate();
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const { unit, property, customer, occupancy, notices, appointments, unitRequests } = q.data;
  const broadband = unit.services.find((s) => s.status !== 'Terminated' && s.offeringId !== 'OFF-V01');
  const voiceService = unit.services.find((s) => s.offeringId === 'OFF-V01' && s.status !== 'Terminated');
  const current = occupancy.find((o) => !o.validTo);
  const upcoming = appointments.filter((a) => a.status === 'Scheduled' || a.status === 'Rescheduled');

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Home className="h-8 w-8 text-crimson" /> My Home
          </span>
        }
        subtitle={`${property.name} · ${unit.building} · Floor ${unit.floor} · Unit ${unit.number}`}
        crumbs={[{ label: 'Dashboard', to: '/' }, { label: 'My Home' }]}
        actions={
          <LinkButton to={`/requests/new?unit=${unit.id}`} variant="primary">
            <LifeBuoy className="h-4 w-4" /> Report a home issue
          </LinkButton>
        }
      />

      {notices.length > 0 && (
        <div className="mb-6 rounded-card border border-amber-200 bg-amber-50 p-5">
          <p className="mb-2 flex items-center gap-2 font-bold text-amber-900">
            <Megaphone className="h-5 w-5" /> Building notices
          </p>
          <ul className="space-y-1.5 text-sm text-amber-900">
            {notices.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2">
                <StatusBadge status={n.status} /> {n.title} <span className="text-xs text-amber-800">· target {date(n.slaDue)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="My unit" className="lg:col-span-2">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Address">
              {unit.number}, {unit.building}, {property.name}, {property.address}, {property.city}
            </Stat>
            <Stat label="Unit type">{unit.unitType}</Stat>
            <Stat label="Your relationship">{current ? `${current.role} since ${date(current.validFrom)}` : '—'}</Stat>
            <Stat label="Network at this unit">
              <StatusBadge status={unit.networkReadiness} /> <span className="text-xs text-ink-600">{property.technology}</span>
            </Stat>
            <Stat label="Connection status">
              <StatusBadge status={unit.connectivity} />
            </Stat>
            <Stat label="Unit ID">
              <span className="font-mono text-xs">{unit.id}</span>
            </Stat>
          </dl>
        </Card>

        <Card title="Property management office">
          <dl className="space-y-3">
            <Stat label="Managed by">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-royal" /> {property.managementOrg}
              </span>
            </Stat>
            <Stat label="Phone">
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-royal" /> {property.contactPhone}
              </span>
            </Stat>
            <Stat label="Email">{property.contactEmail}</Stat>
          </dl>
          <p className="mt-3 text-[11px] text-ink-400">For building access, parking or maintenance, contact the office. For internet issues, use “Report a home issue”.</p>
        </Card>

        <Card title="Home connection & equipment" className="lg:col-span-2">
          {broadband ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <dl className="space-y-3">
                <Stat label="Service at this unit">{broadband.offeringName}</Stat>
                <Stat label="Service ID">
                  <span className="font-mono text-xs">{broadband.id}</span>
                </Stat>
                <Stat label="Installed">{date(broadband.activationDate)}</Stat>
              </dl>
              <div className="space-y-2">
                {broadband.equipment.length ? (
                  broadband.equipment.map((e) => (
                    <div key={e.serial} className="flex items-center gap-3 rounded-xl border border-line-100 p-3">
                      <Router className="h-6 w-6 text-royal" />
                      <div>
                        <p className="text-sm font-semibold text-navy">{e.type}</p>
                        <p className="font-mono text-xs text-ink-400">S/N {e.serial}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink-600">Equipment will be installed at your appointment.</p>
                )}
                <LinkButton to={`/services/${broadband.id}`} size="sm" variant="ghost" className="px-0">
                  Manage plan & add-ons →
                </LinkButton>
              </div>
            </div>
          ) : (
            <div className="text-sm text-ink-700">
              No broadband at this unit yet.{' '}
              <LinkButton to={`/services/new?unit=${unit.id}`} size="sm" variant="primary" className="ml-2">
                Check availability & order
              </LinkButton>
            </div>
          )}
        </Card>

        <Card title="Home phone (FixedVoice)">
          {voiceService ? (
            <dl className="space-y-3">
              <Stat label="Assigned number">
                <span className="flex items-center gap-1.5 text-lg font-semibold text-navy">
                  <Phone className="h-4 w-4 text-royal" />
                  {voiceService.phoneNumber ?? '—'}
                </span>
              </Stat>
              <Stat label="Status"><StatusBadge status={voiceService.status} /></Stat>
              <Stat label="Plan">{voiceService.offeringName}</Stat>
            </dl>
          ) : (
            <div className="text-sm text-ink-700">
              No FixedVoice service at this unit.{' '}
              <LinkButton to={`/services/new?unit=${unit.id}`} size="sm" variant="primary" className="ml-2">
                Add FixedVoice
              </LinkButton>
            </div>
          )}
          {voiceService && (
            <LinkButton to={`/services/${voiceService.id}`} size="sm" variant="ghost" className="mt-3 px-0">
              Manage plan & add-ons →
            </LinkButton>
          )}
        </Card>

        <Card title="Visits & appointments">
          {upcoming.length ? (
            <ul className="space-y-2">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-xl border border-line-100 p-3 text-sm">
                  <CalendarClock className="mt-0.5 h-5 w-5 text-crimson" />
                  <div>
                    <p className="font-semibold text-navy">
                      {date(a.slot)} · {a.window}
                    </p>
                    <p className="text-xs text-ink-600">Technician: {a.technician}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-600">No visits scheduled.</p>
          )}
          <LinkButton to="/requests/appointments" size="sm" variant="ghost" className="mt-2 px-0">
            Reschedule or view history →
          </LinkButton>
        </Card>

        <Card title="Identity & consent" className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <KycBadge kyc={customer.kyc} />
            <span className="text-sm text-ink-700">{[customer.kyc.method, customer.kyc.maskedRef].filter(Boolean).join(' · ')}</span>
            {customer.kyc.source && <span className="text-xs text-ink-400">verified at {customer.kyc.source}</span>}
          </div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-ink-400">
            <ShieldCheck className="h-3.5 w-3.5" /> Consents you have given
          </p>
          <ul className="divide-y divide-line-100 text-sm">
            {customer.consents.map((c, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-ink-700">{c.purpose}</span>
                <span className="text-xs text-ink-400">
                  {c.channel} · {date(c.at)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink-400">To withdraw a consent or request erasure, raise an “Account Modification” request in the Service Center.</p>
        </Card>

        <Card title="Issues reported for this home">
          {unitRequests.length ? (
            <ul className="space-y-2">
              {unitRequests.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <button onClick={() => nav(`/requests/${r.id}`)} className="w-full rounded-xl border border-line-100 p-2 text-left text-sm hover:border-crimson">
                    <p className="font-medium text-navy">{r.title}</p>
                    <p className="mt-1 flex items-center justify-between text-xs text-ink-400">
                      <StatusBadge status={r.status} /> {dateTime(r.timeline[0]?.at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-600">No issues reported.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
