import { useState } from 'react';
import { listProperties, listUnits } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { date } from '../../lib/format';
import { Card, DataTable, ErrorState, Kpi, Loading, PageHeader, SearchBox, Select, StatusBadge } from '../../components/ui';
import { AssignOccupantModal, UnitDrawer } from './UnitDrawer';

export function Occupancy() {
  const props = useApi(listProperties);
  const [pid, setPid] = useState('');
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
      <PageHeader title="Occupancy Management" subtitle="Assign, update and end-date occupants. Occupancy changes never alter active services or billing responsibility." crumbs={[{ label: 'MDU Portfolio', to: '/mdu' }, { label: 'Occupancy' }]} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Units" value={all.length} />
        <Kpi label="Occupied" value={all.filter((u) => u.occupancy === 'Occupied').length} />
        <Kpi label="Vacant" value={all.filter((u) => u.occupancy === 'Vacant').length} />
        <Kpi label="Occupancy unknown" value={all.filter((u) => u.occupancy === 'Unknown').length} tone="orange" hint="Verify with site office" />
      </div>
      <Card>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_220px_160px]">
          <SearchBox value={search} onChange={setSearch} placeholder="Search unit, property or occupant" />
          <Select label="Property" value={pid} onChange={setPid} options={[{ value: '', label: 'All properties' }, ...props.data.map((p) => ({ value: p.id, label: p.name }))]} />
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
      {assign && <AssignOccupantModal unitId={assign} onClose={() => setAssign(null)} />}
    </div>
  );
}
