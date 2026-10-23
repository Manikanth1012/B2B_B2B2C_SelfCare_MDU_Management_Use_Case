import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Building, ChevronDown, ChevronRight, FolderTree, HelpCircle, LayoutGrid, User, UserX, Zap } from 'lucide-react';
import { can, type PropertyDetail, type UnitView } from '../../api/api';
import type { ConnectivityStatus } from '../../data/types';
import { Button, Select } from '../../components/ui';
import { UnitDrawer } from './UnitDrawer';

export const CONN_STYLE: Record<ConnectivityStatus, { tile: string; dot: string; short: string }> = {
  Connected: { tile: 'bg-emerald-500 text-white border-emerald-600', dot: 'bg-emerald-500', short: 'Connected' },
  'Ready for Service': { tile: 'bg-white text-royal border-royal', dot: 'bg-white border border-royal', short: 'Ready' },
  'Pending Installation': { tile: 'bg-amber-300 text-amber-950 border-amber-500', dot: 'bg-amber-300', short: 'Pending' },
  'Network Not Ready': { tile: 'hatch bg-red-50 text-red-800 border-red-300', dot: 'hatch bg-red-50 border border-red-300', short: 'Not ready' },
  Suspended: { tile: 'bg-violet-500 text-white border-violet-600', dot: 'bg-violet-500', short: 'Suspended' },
};

export function OccIcon({ o, className }: { o: UnitView['occupancy']; className?: string }) {
  if (o === 'Occupied') return <User className={className} aria-label="Occupied" />;
  if (o === 'Vacant') return <UserX className={className} aria-label="Vacant" />;
  return <HelpCircle className={className} aria-label="Occupancy unknown" />;
}

export function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
      {(Object.keys(CONN_STYLE) as ConnectivityStatus[]).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={clsx('h-3.5 w-3.5 rounded-sm', CONN_STYLE[k].dot)} />
          {k}
        </span>
      ))}
      <span className="flex items-center gap-1 border-l border-slate-200 pl-3">
        <User className="h-3.5 w-3.5" /> Occupied
      </span>
      <span className="flex items-center gap-1">
        <UserX className="h-3.5 w-3.5" /> Vacant
      </span>
      <span className="flex items-center gap-1">
        <HelpCircle className="h-3.5 w-3.5" /> Occupancy unknown
      </span>
    </div>
  );
}

export function BuildingsUnits({ propertyId, buildings }: { propertyId: string; buildings: PropertyDetail['buildings'] }) {
  const [view, setView] = useState<'grid' | 'tree'>('grid');
  const [bIdx, setBIdx] = useState(0);
  const [conn, setConn] = useState('All connectivity');
  const [occ, setOcc] = useState('All occupancy');
  const [floor, setFloor] = useState('All floors');
  const [unit, setUnit] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set([buildings[0]?.id]));
  const nav = useNavigate();
  const b = buildings[Math.min(bIdx, buildings.length - 1)];
  if (!b) return <p className="text-sm text-slate-500">No buildings configured.</p>;

  const match = (u: UnitView) => (conn === 'All connectivity' || u.connectivity === conn) && (occ === 'All occupancy' || u.occupancy === occ);
  const floors = [...b.floors].reverse().filter((f) => floor === 'All floors' || String(f.number) === floor);
  const eligible = (u: UnitView) => u.connectivity === 'Ready for Service';
  const toggleSel = (u: UnitView) => setSelected((s) => (s.includes(u.id) ? s.filter((x) => x !== u.id) : [...s, u.id]));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-line-200 bg-white p-1">
          <button onClick={() => setView('grid')} aria-pressed={view === 'grid'} className={clsx('flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold', view === 'grid' ? 'bg-brand text-white' : 'text-slate-600')}>
            <LayoutGrid className="h-4 w-4" /> Unit grid
          </button>
          <button onClick={() => setView('tree')} aria-pressed={view === 'tree'} className={clsx('flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold', view === 'tree' ? 'bg-brand text-white' : 'text-slate-600')}>
            <FolderTree className="h-4 w-4" /> Hierarchy
          </button>
        </div>
        <Select label="Connectivity filter" value={conn} onChange={setConn} options={['All connectivity', ...Object.keys(CONN_STYLE)]} className="w-48" />
        <Select label="Occupancy filter" value={occ} onChange={setOcc} options={['All occupancy', 'Occupied', 'Vacant', 'Unknown']} className="w-40" />
        {can('service.bulk') && view === 'grid' && (
          <Button size="sm" variant={selecting ? 'primary' : 'secondary'} onClick={() => (setSelecting(!selecting), setSelected([]))}>
            <Zap className="h-4 w-4" /> {selecting ? 'Cancel selection' : 'Select for bulk activation'}
          </Button>
        )}
      </div>

      {view === 'grid' ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {buildings.map((x, i) => (
              <button key={x.id} onClick={() => (setBIdx(i), setFloor('All floors'))} className={clsx('flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold', i === bIdx ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-navy')}>
                <Building className="h-3.5 w-3.5" /> {x.name}
              </button>
            ))}
            <Select label="Floor" value={floor} onChange={setFloor} options={['All floors', ...b.floors.map((f) => String(f.number))]} className="ml-auto w-32" />
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">
              {b.name} · {b.floors.length} floors · {b.floors.reduce((a, f) => a + f.units.length, 0)} units
            </p>
            <div className="space-y-1.5">
              {floors.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-right text-xs font-semibold text-slate-500">Floor {f.number}</span>
                  <div className="flex gap-1.5">
                    {f.units.map((u) => {
                      const dim = !match(u);
                      const sel = selected.includes(u.id);
                      const canSel = selecting && eligible(u);
                      return (
                        <button
                          key={u.id}
                          onClick={() => (selecting ? canSel && toggleSel(u) : setUnit(u.id))}
                          aria-label={`${u.number}: ${u.connectivity}, ${u.occupancy}`}
                          title={`${u.number} · ${u.connectivity} · ${u.occupancy}`}
                          className={clsx('relative flex h-14 w-[72px] shrink-0 flex-col items-center justify-center rounded-md border text-xs font-bold transition', CONN_STYLE[u.connectivity].tile, dim && 'opacity-20', selecting && !canSel && 'cursor-not-allowed opacity-30', sel && 'ring-4 ring-brandorange ring-offset-1', !selecting && 'hover:scale-105 hover:shadow')}
                        >
                          {u.number}
                          <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-semibold opacity-90">
                            <OccIcon o={u.occupancy} className="h-3 w-3" />
                            {CONN_STYLE[u.connectivity].short}
                          </span>
                          {u.openTickets > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-red-600" title="Open ticket" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <Legend />
          </div>
          {selecting && (
            <div className="sticky bottom-16 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 md:bottom-2">
              <span className="text-sm text-orange-900">
                <b>{selected.length}</b> ready-for-service units selected. Only units marked Ready can be selected.
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setSelected(b.floors.flatMap((f) => f.units).filter(eligible).map((u) => u.id))}>
                  Select all ready in {b.name}
                </Button>
                <Button size="sm" variant="cta" disabled={!selected.length} onClick={() => nav(`/services/bulk?property=${propertyId}&units=${selected.join(',')}`)}>
                  Continue to bulk activation
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <ul role="tree" className="text-sm">
          {buildings.map((x) => {
            const open = openNodes.has(x.id);
            const all = x.floors.flatMap((f) => f.units);
            return (
              <li key={x.id} role="treeitem" aria-expanded={open}>
                <button className="flex w-full items-center gap-2 rounded px-1 py-1.5 hover:bg-slate-50" onClick={() => setOpenNodes((s) => new Set(open ? [...s].filter((y) => y !== x.id) : [...s, x.id]))}>
                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Building className="h-4 w-4 text-royal" />
                  <span className="font-semibold text-navy">{x.name}</span>
                  <span className="text-xs text-slate-500">
                    {x.floors.length} floors · {all.length} units · {all.filter((u) => u.connectivity === 'Connected').length} connected
                  </span>
                </button>
                {open && (
                  <ul role="group" className="ml-6 border-l border-slate-200 pl-2">
                    {x.floors.map((f) => {
                      const fo = openNodes.has(f.id);
                      const units = f.units.filter(match);
                      return (
                        <li key={f.id} role="treeitem" aria-expanded={fo}>
                          <button className="flex w-full items-center gap-2 rounded px-1 py-1 hover:bg-slate-50" onClick={() => setOpenNodes((s) => new Set(fo ? [...s].filter((y) => y !== f.id) : [...s, f.id]))}>
                            {fo ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            Floor {f.number}
                            <span className="flex gap-0.5">
                              {f.units.map((u) => (
                                <span key={u.id} className={clsx('h-2.5 w-2.5 rounded-sm', CONN_STYLE[u.connectivity].dot)} />
                              ))}
                            </span>
                          </button>
                          {fo && (
                            <ul role="group" className="ml-6 border-l border-slate-200 pl-2">
                              {units.map((u) => (
                                <li key={u.id} role="treeitem">
                                  <button onClick={() => setUnit(u.id)} className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-royal-50">
                                    <span className={clsx('h-3 w-3 rounded-sm', CONN_STYLE[u.connectivity].dot)} />
                                    <span className="w-16 font-semibold">{u.number}</span>
                                    <span className="w-36 text-xs text-slate-600">{u.connectivity}</span>
                                    <OccIcon o={u.occupancy} className="h-3.5 w-3.5 text-slate-500" />
                                    <span className="truncate text-xs text-slate-500">{u.occupant?.name ?? u.occupancy}</span>
                                  </button>
                                </li>
                              ))}
                              {!units.length && <li className="px-1 py-1 text-xs text-slate-400">No units match filters</li>}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {unit && <UnitDrawer unitId={unit} onClose={() => setUnit(null)} />}
    </div>
  );
}
