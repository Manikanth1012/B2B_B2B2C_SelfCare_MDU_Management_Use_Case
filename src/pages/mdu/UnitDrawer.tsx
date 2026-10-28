import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LifeBuoy, PauseCircle, PlayCircle, Plus, Radar, Repeat, ShieldCheck, UserPlus } from 'lucide-react';
import { can, checkAvailability, currentUser, getUnit, setOccupancy } from '../../api/api';
import { KycBadge, OccupantOnboardingModal, VerifyKycModal } from './OccupantOnboarding';
import type { Occupancy, ServiceQualification } from '../../data/types';
import { useApi } from '../../lib/hooks';
import { date, money } from '../../lib/format';
import { Button, Drawer, ErrorState, Loading, Stat, StatusBadge, useAction } from '../../components/ui';

export function UnitDrawer({ unitId, onClose }: { unitId: string; onClose: () => void }) {
  const q = useApi(() => getUnit(unitId), [unitId]);
  const nav = useNavigate();
  const [qual, setQual] = useState<ServiceQualification | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { run, busy } = useAction();
  const u = q.data;
  const broadband = u?.services.find((s) => s.offeringId.startsWith('OFF-R') && s.status !== 'Terminated');
  const manage = can('unit.manage') && currentUser().roleId !== 'RESIDENT';

  // Eligibility for each action is evaluated up-front so disabled buttons explain themselves.
  const reasons = {
    connect: !can('service.order') ? 'Your role cannot place orders' : broadband ? 'Unit already has a broadband subscription' : u?.networkReadiness === 'Not Ready' ? 'Network not ready at this unit' : null,
    change: !broadband ? 'No broadband subscription' : broadband.status !== 'Active' ? `Subscription is ${broadband.status}` : broadband.pendingChange ? 'A change is already pending' : null,
    suspend: !broadband ? 'No broadband subscription' : broadband.pendingChange ? 'A change is already pending' : !['Active', 'Suspended'].includes(broadband.status) ? `Subscription is ${broadband.status}` : null,
  };

  return (
    <Drawer open onClose={onClose} title={u ? `Unit ${u.number}` : 'Unit'} subtitle={u ? `${u.propertyName} · ${u.building} · Floor ${u.floor}` : undefined}>
      {q.error && <ErrorState error={q.error} />}
      {!u ? (
        <Loading />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">Connectivity</p>
              <StatusBadge status={u.connectivity} className="mt-1" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Occupancy</p>
              <StatusBadge status={u.occupancy} className="mt-1" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Network readiness</p>
              <StatusBadge status={u.networkReadiness} className="mt-1" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Open tickets</p>
              <p className="mt-1 text-sm font-bold text-navy">{u.openTickets}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Unit ID">
              <span className="font-mono text-xs">{u.id}</span>
            </Stat>
            <Stat label="Unit type">{u.unitType}</Stat>
            <Stat label="Tower / floor">
              {u.building} · Floor {u.floor}
            </Stat>
            <Stat label="Existing service ref">{u.existingServiceRef}</Stat>
            <Stat label="Occupant / authorised contact">{u.occupant ? `${u.occupant.name} (${u.occupant.role})` : 'None recorded'}</Stat>
            <Stat label="Since">{date(u.occupant?.since)}</Stat>
            {u.occupant && (
              <Stat label="Customer KYC">
                <KycBadge kyc={u.occupant.kyc} />
                <span className="mt-0.5 block text-[11px] text-ink-400">{[u.occupant.kyc.method, u.occupant.kyc.maskedRef].filter(Boolean).join(' · ') || u.occupant.kyc.note}</span>
              </Stat>
            )}
            {u.occupant && (
              <>
                <Stat label="Email">{u.occupant.email || '—'}</Stat>
                <Stat label="Phone">{u.occupant.phone || '—'}</Stat>
              </>
            )}
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-bold text-navy">Subscriptions</h3>
            {u.services.length ? (
              <ul className="space-y-2">
                {u.services.map((s) => (
                  <li key={s.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-navy">{s.offeringName}</p>
                        <p className="font-mono text-[11px] text-slate-500">{s.id}</p>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <Stat label="Monthly charge">{money(s.mrc)}</Stat>
                      <Stat label="Billing responsibility">{s.billedTo}</Stat>
                      <Stat label="Activated">{date(s.activationDate)}</Stat>
                      <Stat label="Equipment">{s.equipment.map((e) => `${e.type} (${e.serial})`).join(', ') || 'Pending installation'}</Stat>
                    </dl>
                    {s.pendingChange && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">Pending: {s.pendingChange}</p>}
                    <Button size="sm" variant="ghost" className="mt-1 px-0" onClick={() => nav(`/services/${s.id}`)}>
                      View subscription →
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No subscriptions on this unit.</p>
            )}
          </div>

          {qual && (
            <div className="rounded-lg border p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-semibold">Availability:</span>
                <StatusBadge status={qual.result} />
              </div>
              <p className="text-slate-600">{qual.reason}</p>
              <p className="mt-1 font-mono text-[11px] text-slate-400">{qual.id}</p>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-bold text-navy">Actions</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {manage && (
                <ActionBtn icon={<UserPlus className="h-4 w-4" />} onClick={() => setAssigning(true)}>
                  {u.occupant ? 'Update occupant' : 'Assign occupant'}
                </ActionBtn>
              )}
              {manage && u.occupant && u.occupant.kyc.status !== 'Verified' && (
                <ActionBtn icon={<ShieldCheck className="h-4 w-4" />} disabled={u.occupant.kyc.status === 'Pending Review' ? 'Document review pending with operator' : null} onClick={() => setVerifying(true)}>
                  Verify occupant KYC
                </ActionBtn>
              )}
              <ActionBtn icon={<Radar className="h-4 w-4" />} loading={busy} onClick={async () => setQual((await run(() => checkAvailability({ kind: 'unit', unitId: u.id }))) ?? null)}>
                Check service availability
              </ActionBtn>
              <ActionBtn icon={<Plus className="h-4 w-4" />} disabled={reasons.connect} onClick={() => nav(`/services/new?unit=${u.id}`)}>
                Request new connection
              </ActionBtn>
              <ActionBtn icon={<Repeat className="h-4 w-4" />} disabled={reasons.change} onClick={() => nav(`/services/${broadband!.id}?action=plan`)}>
                Change broadband plan
              </ActionBtn>
              <ActionBtn icon={broadband?.status === 'Suspended' ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />} disabled={reasons.suspend} onClick={() => nav(`/services/${broadband!.id}?action=${broadband!.status === 'Suspended' ? 'resume' : 'suspend'}`)}>
                {broadband?.status === 'Suspended' ? 'Resume service' : 'Suspend service'}
              </ActionBtn>
              <ActionBtn icon={<LifeBuoy className="h-4 w-4" />} disabled={!can('request.create') ? 'Not permitted' : null} onClick={() => nav(`/requests/new?unit=${u.id}`)}>
                Raise service ticket
              </ActionBtn>
            </div>
            {manage && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-slate-600">Set occupancy:</span>
                {(['Occupied', 'Vacant', 'Unknown'] as Occupancy[])
                  .filter((o) => o !== u.occupancy && o !== 'Occupied')
                  .map((o) => (
                    <Button key={o} size="sm" variant="secondary" onClick={() => run(() => setOccupancy(u.id, o), `Marked ${o.toLowerCase()} — services and billing unchanged`)}>
                      {o}
                    </Button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
      {assigning && u && <OccupantOnboardingModal unitId={u.id} unitLabel={`${u.propertyName} ${u.number}`} currentOccupant={u.occupant?.name} onClose={() => setAssigning(false)} />}
      {verifying && u?.occupant && <VerifyKycModal unitId={u.id} occupantName={u.occupant.name} onClose={() => setVerifying(false)} />}
    </Drawer>
  );
}

function ActionBtn({ children, icon, onClick, disabled, loading }: { children: React.ReactNode; icon: React.ReactNode; onClick: () => void; disabled?: string | null; loading?: boolean }) {
  return (
    <div>
      <Button variant="secondary" className="w-full justify-start" onClick={onClick} disabled={!!disabled} loading={loading} title={disabled ?? undefined}>
        {icon}
        {children}
      </Button>
      {disabled && <p className="mt-0.5 text-[11px] text-slate-500">{disabled}</p>}
    </div>
  );
}
