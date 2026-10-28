import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Phone, Upload } from 'lucide-react';
import { bulkTogglePhoneNumbers, getPhoneNumbers, importPhoneNumbers, listProperties, togglePhoneNumber } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { downloadText } from '../../lib/format';
import { Button, Card, ErrorState, Field, Loading, Modal, PageHeader, Select, SimNote, StatusBadge, useAction } from '../../components/ui';

export function PhoneNumbers() {
  const [params, setParams] = useSearchParams();
  const propId = params.get('property') ?? '';
  const props = useApi(listProperties);
  const q = useApi(() => (propId ? Promise.resolve(getPhoneNumbers(propId)) : Promise.resolve([])), [propId]);
  const [floor, setFloor] = useState('All');
  const [selected, setSelected] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const { run, busy } = useAction();

  if (props.error || q.error) return <ErrorState error={props.error ?? q.error!} />;
  if (!props.data) return <Loading />;

  const property = props.data.find((p) => p.id === propId);
  const allNumbers = q.data ?? [];

  // Derive unique floors from actual unit IDs
  const floorSet = new Set<string>();
  allNumbers.forEach((n) => {
    const seg = n.unitId.split('-');
    const unitNum = seg[seg.length - 1] ?? '';
    if (unitNum.length >= 2) floorSet.add(unitNum[0]);
  });
  const floors = ['All', ...[...floorSet].sort()];

  const numbers = allNumbers.filter((n) => {
    if (floor === 'All') return true;
    const seg = n.unitId.split('-');
    const unitNum = seg[seg.length - 1] ?? '';
    return unitNum.startsWith(floor);
  });

  const unitLabel = (unitId: string) => unitId.replace(`${propId}-`, '');

  const toggleSelect = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allSelected = numbers.length > 0 && numbers.every((n) => selected.includes(n.id));
  const toggleAll = () => setSelected(allSelected ? [] : numbers.map((n) => n.id));

  async function handleBulkToggle(enabled: boolean) {
    const unitIds = allNumbers.filter((n) => selected.includes(n.id)).map((n) => n.unitId);
    await run(() => { bulkTogglePhoneNumbers(propId, unitIds, enabled); return Promise.resolve(); }, enabled ? 'Numbers enabled' : 'Numbers disabled');
    setSelected([]);
  }

  async function handleToggle(numberId: string, enabled: boolean) {
    await run(() => { togglePhoneNumber(numberId, enabled); return Promise.resolve(); }, enabled ? 'Number enabled' : 'Number disabled');
  }

  function downloadTemplate() {
    const header = '# Phone number import template\n# Format: unit_number,phone_number\n# Unit number can be short (A-101) or full (PRP-GV-A-101)\nunit_number,phone_number\n';
    const rows = allNumbers.map((n) => `${unitLabel(n.unitId)},${n.number}`).join('\n');
    downloadText('phone-numbers-template.csv', header + rows);
  }

  return (
    <div>
      <PageHeader
        title={<span className="flex items-center gap-2"><Phone className="h-6 w-6 text-royal" /> Phone Number Inventory</span>}
        subtitle={property ? `${property.name} — one number pre-assigned per unit; status follows the customer's FixedVoice plan` : 'Select a property'}
        crumbs={[
          { label: 'MDU Portfolio', to: '/mdu' },
          property ? { label: property.name, to: `/mdu/${propId}` } : { label: 'Properties', to: '/mdu' },
          { label: 'Phone Numbers' },
        ]}
        actions={
          propId && (
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4" /> Import CSV
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          label="Property"
          value={propId}
          onChange={(v) => { setParams({ property: v }); setSelected([]); setFloor('All'); }}
          options={props.data.map((p) => ({ value: p.id, label: p.name }))}
          className="w-64"
        />
        {floors.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {floors.map((f) => (
              <button
                key={f}
                onClick={() => setFloor(f)}
                className={`rounded-full px-3 py-1 text-sm font-medium ${floor === f ? 'bg-brand text-white' : 'border border-line-200 text-ink-600 hover:bg-surface-50'}`}
              >
                {f === 'All' ? 'All Floors' : `Floor ${f}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-royal/20 bg-royal/5 px-4 py-2.5 text-sm">
          <span className="font-medium text-navy">{selected.length} selected</span>
          <Button size="sm" variant="secondary" loading={busy} onClick={() => handleBulkToggle(true)}>Enable</Button>
          <Button size="sm" variant="secondary" loading={busy} onClick={() => handleBulkToggle(false)}>Disable</Button>
          <button className="ml-auto text-ink-400 hover:text-ink-700" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      <Card>
        {!propId ? (
          <p className="py-6 text-center text-sm text-ink-600">Select a property to view phone numbers.</p>
        ) : numbers.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-600">No phone numbers found for this property. Use Import CSV to upload numbers.</p>
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
                {numbers.map((n) => (
                  <tr key={n.id} className="hover:bg-surface-50">
                    <td className="py-3 pr-3">
                      <input type="checkbox" checked={selected.includes(n.id)} onChange={() => toggleSelect(n.id)} className="h-4 w-4 rounded" />
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-navy">{unitLabel(n.unitId)}</td>
                    <td className="py-3 pr-4 font-medium text-navy">{n.number}</td>
                    <td className="py-3 pr-4"><StatusBadge status={n.status} /></td>
                    <td className="py-3">
                      {n.status === 'Active' ? (
                        <button onClick={() => handleToggle(n.id, false)} className="text-xs font-bold text-crimson hover:underline">Disable</button>
                      ) : (
                        <button
                          onClick={() => handleToggle(n.id, true)}
                          className="text-xs font-bold text-royal hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={n.status === 'Reserved'}
                          title={n.status === 'Reserved' ? 'Reserved — cannot enable manually' : 'Enable — requires an active FixedVoice plan on this unit'}
                        >
                          Enable
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {importing && (
        <ImportModal
          propId={propId}
          onDownloadTemplate={downloadTemplate}
          onClose={() => setImporting(false)}
        />
      )}
    </div>
  );
}

function ImportModal({ propId, onDownloadTemplate, onClose }: { propId: string; onDownloadTemplate: () => void; onClose: () => void }) {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const { run, busy } = useAction();

  async function handleImport() {
    const res = await run(() => Promise.resolve(importPhoneNumbers(propId, csv)), (r) => `${r.imported} numbers imported${r.skipped ? `, ${r.skipped} skipped` : ''}`);
    if (res !== undefined) setResult(res as { imported: number; skipped: number; errors: string[] });
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Import Phone Numbers"
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button loading={busy} disabled={!csv.trim()} onClick={handleImport}>Import</Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{result.imported}</p>
              <p className="text-sm text-green-600">Numbers imported</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
              <p className="text-sm text-amber-600">Rows skipped</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="rounded-xl border border-crimson/20 bg-crimson-50 p-3">
              <p className="mb-1 text-xs font-bold text-crimson">Errors</p>
              <ul className="space-y-0.5 text-xs text-crimson">
                {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-600">
              One row per unit: <code className="rounded bg-surface-100 px-1 text-xs">unit_number,phone_number</code>
            </p>
            <button onClick={onDownloadTemplate} className="text-xs font-bold text-royal hover:underline">
              Download current numbers as template
            </button>
          </div>
          <Field label="CSV data">
            <textarea
              className="w-full rounded-xl border border-line-200 p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-royal/40"
              rows={12}
              placeholder={'# Paste CSV here\nunit_number,phone_number\nA-101,+91-080-000001\nA-102,+91-080-000002'}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
          </Field>
          <SimNote>
            Short unit IDs (A-101) or full IDs (PRP-GV-A-101) are both accepted. Existing Available numbers are updated; Active numbers are skipped. Numbers already assigned to another property are rejected.
          </SimNote>
        </div>
      )}
    </Modal>
  );
}
