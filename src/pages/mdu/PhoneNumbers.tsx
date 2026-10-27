import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { bulkTogglePhoneNumbers, getPhoneNumbers, listProperties, togglePhoneNumber } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { Button, Card, ErrorState, Loading, PageHeader, Select, StatusBadge, useAction } from '../../components/ui';

export function PhoneNumbers() {
  const [params, setParams] = useSearchParams();
  const propId = params.get('property') ?? '';
  const props = useApi(listProperties);
  const q = useApi(() => (propId ? Promise.resolve(getPhoneNumbers(propId)) : Promise.resolve([])), [propId]);
  const [floor, setFloor] = useState('All');
  const [selected, setSelected] = useState<string[]>([]);
  const { run, busy } = useAction();

  if (props.error || q.error) return <ErrorState error={props.error ?? q.error!} />;
  if (!props.data) return <Loading />;

  const property = props.data.find((p) => p.id === propId);
  const numbers = (q.data ?? []).filter((n) => {
    if (floor === 'All') return true;
    // e.g. unitId = 'PRP-GV-A-201' → floor segment is '2'
    const parts = n.unitId.split('-');
    const unitNum = parts[parts.length - 1] ?? '';
    return unitNum.startsWith(floor);
  });

  const floors = ['All', '1', '2', '3'];
  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = numbers.length > 0 && numbers.every((n) => selected.includes(n.id));
  const toggleAll = () => setSelected(allSelected ? [] : numbers.map((n) => n.id));

  async function handleBulkToggle(enabled: boolean) {
    const unitIds = (q.data ?? []).filter((n) => selected.includes(n.id)).map((n) => n.unitId);
    await run(
      () => {
        bulkTogglePhoneNumbers(propId, unitIds, enabled);
        return Promise.resolve();
      },
      enabled ? 'Numbers enabled' : 'Numbers disabled',
    );
    setSelected([]);
  }

  async function handleToggle(numberId: string, enabled: boolean) {
    await run(
      () => {
        togglePhoneNumber(numberId, enabled);
        return Promise.resolve();
      },
      enabled ? 'Number enabled' : 'Number disabled',
    );
  }

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Phone className="h-6 w-6 text-royal" /> Phone Number Inventory
          </span>
        }
        subtitle={property ? `${property.name} — pre-assigned fixed line numbers` : 'Select a property'}
        crumbs={[
          { label: 'MDU Portfolio', to: '/mdu' },
          property ? { label: property.name, to: `/mdu/${propId}` } : { label: 'Properties', to: '/mdu' },
          { label: 'Phone Numbers' },
        ]}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          label="Property"
          value={propId}
          onChange={(v) => {
            setParams({ property: v });
            setSelected([]);
          }}
          options={props.data.map((p) => ({ value: p.id, label: p.name }))}
          className="w-64"
        />
        <div className="flex gap-1">
          {floors.map((f) => (
            <button
              key={f}
              onClick={() => setFloor(f)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                floor === f ? 'bg-brand text-white' : 'border border-line-200 text-ink-600 hover:bg-surface-50'
              }`}
            >
              {f === 'All' ? 'All Floors' : `Floor ${f}`}
            </button>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-royal/20 bg-royal/5 px-4 py-2.5 text-sm">
          <span className="font-medium text-navy">{selected.length} selected</span>
          <Button size="sm" variant="secondary" loading={busy} onClick={() => handleBulkToggle(true)}>
            Enable
          </Button>
          <Button size="sm" variant="secondary" loading={busy} onClick={() => handleBulkToggle(false)}>
            Disable
          </Button>
          <button className="ml-auto text-ink-400 hover:text-ink-700" onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}

      <Card>
        {!propId ? (
          <p className="py-6 text-center text-sm text-ink-600">Select a property to view phone numbers.</p>
        ) : numbers.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-600">No phone numbers found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-200 text-left text-xs font-bold uppercase text-ink-400">
                  <th className="py-3 pr-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded" />
                  </th>
                  <th className="py-3 pr-4">Unit</th>
                  <th className="py-3 pr-4">Number</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-100">
                {numbers.map((n) => {
                  const unitLabel = n.unitId.split('PRP-GV-')[1] ?? n.unitId;
                  return (
                    <tr key={n.id} className="hover:bg-surface-50">
                      <td className="py-3 pr-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(n.id)}
                          onChange={() => toggleSelect(n.id)}
                          className="h-4 w-4 rounded"
                        />
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-navy">{unitLabel}</td>
                      <td className="py-3 pr-4 font-medium text-navy">{n.number}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={n.status} />
                      </td>
                      <td className="py-3">
                        {n.status === 'Active' ? (
                          <button
                            onClick={() => handleToggle(n.id, false)}
                            className="text-xs font-bold text-crimson hover:underline"
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggle(n.id, true)}
                            className="text-xs font-bold text-royal hover:underline"
                            title={n.status === 'Reserved' ? 'Reserved — cannot enable' : ''}
                            disabled={n.status === 'Reserved'}
                          >
                            Enable
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
