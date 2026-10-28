import { useState } from 'react';
import { listProperties, listUnits } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date } from '../../lib/format';
import { Card, DataTable, ErrorState, Kpi, Loading, PageHeader, SearchBox, Select, StatusBadge } from '../../components/ui';
import { UnitDrawer } from './UnitDrawer';
import { KycBadge, OccupantOnboardingModal } from './OccupantOnboarding';

/**
 * Occupancy list (assign / update / KYC). Used as the cross-property page and,
 * with `propertyId`, as the Residents tab of Property Details — one implementation.
 */
export function Occupancy({ propertyId, embedded }: { propertyId?: string; embedded?: boolean } = {}) {
  const props = useApi(listProperties);
  const [pid, setPid] = useState(propertyId ?? '');
  const units = useApi(() => listUnits(pid || undefined), [pid]);
  const [search, setSearch] = useState('');
  const [occ, setOcc] = useState('All');
  const [unit, setUnit] = useState<string | null>(null);
  const [assign, setAssign] = useState<string | null>(null);
  if (units.error) return <ErrorState error={units.error} />;
  if (!units.data || !props.data) return <Loading />;
  const all = units.data;
  const rows = all.filter((u) => (occ === 'All' || u.occupancy === occ) && (!search || `${u.number} ${u.propertyName} ${u.occupant?.name ?? ''}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <div>
      {!embedded && <PageHeader title="Occupancy Management" subtitle="Assign, update and end-date occupants. Occupancy changes never alter active services or billing responsibility." crumbs={[{ label: 'MDU Portfolio', to: '/mdu' }, { label: 'Occupancy' }]} />}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Units" value={all.length} />
        <Kpi label="Occupied" value={all.filter((u) => u.occupancy === 'Occupied').length} />
        <Kpi label="Vacant" value={all.filter((u) => u.occupancy === 'Vacant').length} />
        <Kpi label="Occupancy unknown" value={all.filter((u) => u.occupancy === 'Unknown').length} tone="orange" hint="Verify with site office" />
        <Kpi label="Occupants without verified KYC" value={all.filter((u) => u.occupant && u.occupant.kyc.status !== 'Verified').length} tone="red" hint="Resident-billed orders blocked" />
      </div>
      <Card>
        <div className={embedded ? 'mb-3 grid gap-2 sm:grid-cols-[1fr_160px]' : 'mb-3 grid gap-2 sm:grid-cols-[1fr_220px_160px]'}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search unit, property or occupant" />
          {!embedded && <Select label="Property" value={pid} onChange={setPid} options={[{ value: '', label: 'All properties' }, ...props.data.map((p) => ({ value: p.id, label: p.name }))]} />}
          <Select label="Occupancy" value={occ} onChange={setOcc} options={['All', 'Occupied', 'Vacant', 'Unknown']} />
        </div>
        <DataTable
          rows={rows}
          rowKey={(u) => u.id}
          onRowClick={(u) => setUnit(u.id)}
          pageSize={15}
          mobileTitle={(u) => `${u.propertyName} · ${u.number}`}
          columns={[
            { key: 'p', header: 'Property', render: (u) => u.propertyName, sort: (u) => u.propertyName, mobileHidden: true },
            { key: 'u', header: 'Unit', render: (u) => <span className="font-semibold">{u.number}</span>, sort: (u) => u.number, mobileHidden: true },
            { key: 't', header: 'Type', render: (u) => u.unitType },
            { key: 'o', header: 'Occupancy', render: (u) => <StatusBadge status={u.occupancy} />, sort: (u) => u.occupancy },
            { key: 'n', header: 'Occupant', render: (u) => (u.occupant ? `${u.occupant.name} (${u.occupant.role})` : '—') },
            { key: 's', header: 'Since', render: (u) => date(u.occupant?.since) },
            { key: 'k', header: 'KYC', render: (u) => (u.occupant ? <KycBadge kyc={u.occupant.kyc} /> : '—'), sort: (u) => u.occupant?.kyc.status ?? '' },
            { key: 'c', header: 'Connectivity', render: (u) => <StatusBadge status={u.connectivity} /> },
            {
              key: 'a',
              header: '',
              mobileHidden: true,
              render: (u) => (
                <button className="text-xs font-semibold text-royal hover:underline" onClick={(e) => (e.stopPropagation(), setAssign(u.id))}>
                  {u.occupant ? 'Change occupant' : 'Assign occupant'}
                </button>
              ),
            },
          ]}
        />
      </Card>
      {unit && <UnitDrawer unitId={unit} onClose={() => setUnit(null)} />}
      {assign && (() => {
        const u = all.find((x) => x.id === assign)!;
        return <OccupantOnboardingModal unitId={u.id} unitLabel={`${u.propertyName} ${u.number}`} currentOccupant={u.occupant?.name} onClose={() => setAssign(null)} />;
      })()}
    </div>
  );
}
