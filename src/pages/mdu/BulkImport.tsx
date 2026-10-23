import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { commitImport, listProperties, validateImport, type ImportRow, type ImportValidation } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { downloadText, parseCsv, toCsv } from '../../lib/format';
import { Button, Card, ConfirmDialog, Kpi, LinkButton, Loading, PageHeader, SimNote, Stepper, useAction, useToast } from '../../components/ui';

const HEADERS = ['Property ID', 'Tower', 'Floor', 'Unit Number', 'Unit Type', 'Occupancy Status', 'Occupant Name', 'Contact Details', 'Connectivity Readiness', 'Existing Service Reference'];

function sampleCsv(pid: string) {
  // Deliberately includes errors so validation and partial success are demonstrable.
  return toCsv([
    HEADERS,
    [pid, 'D', '1', 'D-101', '2BHK', 'Occupied', 'Ravi Shankar', 'ravi.shankar@mail.example', 'Ready', ''],
    [pid, 'D', '1', 'D-102', '3BHK', 'Vacant', '', '', 'Ready', ''],
    [pid, 'D', '1', 'D-103', '2BHK', 'Occupied', 'Meena Iyer', '+91 98450 22113', 'Not Ready', 'LEGACY-88213'],
    [pid, 'D', '2', 'D-201', '2BHK', 'Unknown', '', '', '', ''],
    [pid, 'D', '2', 'D-202', 'Penthouse', 'Occupied', 'Arif Khan', 'arif@mail', 'Ready', ''],
    [pid, 'D', '2', 'D-202', '2BHK', 'Vacant', '', '', 'Ready', ''],
    [pid, 'A', '1', 'A-101', '3BHK', 'Occupied', 'Duplicate Existing', '', 'Ready', ''],
    [pid, 'D', 'two', 'D-203', '1BHK', 'Occupied', '', '', 'Ready', ''],
    ['PRP-PM', 'E', '1', 'E-101', '2BHK', 'Vacant', '', '', 'Ready', ''],
    [pid, 'D', '3', 'D-301', 'Studio', 'Occupied', 'Lata Bose', '+91 99000 11122', 'Maybe', ''],
  ]);
}

function toRows(csv: string): ImportRow[] {
  const [head, ...body] = parseCsv(csv);
  const idx = (h: string) => head.findIndex((x) => x.trim().toLowerCase() === h.toLowerCase());
  const g = (r: string[], h: string) => (idx(h) >= 0 ? (r[idx(h)] ?? '').trim() : '');
  return body.map((r, i) => ({
    line: i + 2,
    propertyId: g(r, 'Property ID'),
    tower: g(r, 'Tower'),
    floor: g(r, 'Floor'),
    unitNumber: g(r, 'Unit Number'),
    unitType: g(r, 'Unit Type'),
    occupancyStatus: g(r, 'Occupancy Status'),
    occupantName: g(r, 'Occupant Name') || undefined,
    contact: g(r, 'Contact Details') || undefined,
    connectivityReadiness: g(r, 'Connectivity Readiness') || undefined,
    existingServiceRef: g(r, 'Existing Service Reference') || undefined,
  }));
}

export function BulkImport() {
  const props = useApi(listProperties);
  const [params] = useSearchParams();
  const [file, setFile] = useState<string>('');
  const [results, setResults] = useState<ImportValidation[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'errors' | 'valid'>('all');
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<{ created: number; skipped: number } | null>(null);
  const { run, busy } = useAction();
  const toast = useToast();
  if (!props.data) return <Loading />;
  const pid = params.get('property') ?? props.data[0]?.id ?? 'PRP-GV';
  const step = done ? 3 : results ? 1 : 0;

  const load = (name: string, text: string) => {
    const rows = toRows(text);
    if (!rows.length) {
      toast('error', 'The file has no data rows.');
      return;
    }
    const missing = ['Property ID', 'Tower', 'Floor', 'Unit Number', 'Unit Type', 'Occupancy Status'].filter((h) => !parseCsv(text)[0].some((x) => x.trim().toLowerCase() === h.toLowerCase()));
    if (missing.length) {
      toast('error', `Missing required columns: ${missing.join(', ')}`);
      return;
    }
    setFile(name);
    setResults(validateImport(rows));
    setDone(null);
  };
  const valid = results?.filter((r) => !r.errors.length) ?? [];
  const invalid = results?.filter((r) => r.errors.length) ?? [];
  const view = (results ?? []).filter((r) => filter === 'all' || (filter === 'errors' ? r.errors.length : !r.errors.length));

  const errorReport = () =>
    downloadText(
      'unit-import-errors.csv',
      toCsv([['Line', ...HEADERS, 'Errors', 'Warnings'], ...invalid.map((r) => [r.row.line, r.row.propertyId, r.row.tower, r.row.floor, r.row.unitNumber, r.row.unitType, r.row.occupancyStatus, r.row.occupantName, r.row.contact, r.row.connectivityReadiness, r.row.existingServiceRef, r.errors.join('; '), r.warnings.join('; ')])]),
    );

  return (
    <div>
      <PageHeader title="Bulk Unit Onboarding" subtitle="Register many units at once from a CSV file. Valid rows import; invalid rows are reported and skipped." crumbs={[{ label: 'MDU Portfolio', to: '/mdu' }, { label: 'Bulk unit import' }]} />
      <Stepper steps={['Upload file', 'Review & validate', 'Import', 'Results']} current={step === 1 && busy ? 2 : step} />
      {!results && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="1. Get the template">
            <p className="mb-3 text-sm text-slate-600">
              Required: <b>Property ID, Tower, Floor, Unit Number, Unit Type, Occupancy Status</b>. Optional: Occupant Name, Contact Details, Connectivity Readiness, Existing Service Reference.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => downloadText('unit-import-template.csv', toCsv([HEADERS, [pid, 'A', '1', 'A-101', '2BHK', 'Occupied', 'Jane Resident', 'jane@mail.example', 'Ready', '']]))}>
                <Download className="h-4 w-4" /> Download CSV template
              </Button>
              <Button variant="secondary" onClick={() => downloadText('unit-import-sample.csv', sampleCsv(pid))}>
                <FileSpreadsheet className="h-4 w-4" /> Download sample (with errors)
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-500">Your properties: {props.data.map((p) => `${p.id} (${p.name})`).join(', ')}</p>
          </Card>
          <Card title="2. Upload">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-200 bg-surface-50 p-8 text-center hover:border-crimson">
              <Upload className="h-8 w-8 text-royal" />
              <span className="text-sm font-semibold text-navy">Choose a CSV file</span>
              <span className="text-xs text-slate-500">UTF-8, comma separated, header row required</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) load(f.name, await f.text());
                }}
              />
            </label>
            <Button variant="ghost" className="mt-2" onClick={() => load('sample-with-errors.csv', sampleCsv(pid))}>
              Or load the demo sample directly
            </Button>
          </Card>
        </div>
      )}

      {results && !done && (
        <Card
          title={`Preview: ${file}`}
          actions={
            <>
              <Button size="sm" variant="secondary" onClick={() => (setResults(null), setFile(''))}>
                Choose another file
              </Button>
              {invalid.length > 0 && (
                <Button size="sm" variant="secondary" onClick={errorReport}>
                  <Download className="h-4 w-4" /> Error report
                </Button>
              )}
              <Button size="sm" disabled={!valid.length} onClick={() => setConfirm(true)}>
                Import {valid.length} valid row{valid.length === 1 ? '' : 's'}
              </Button>
            </>
          }
        >
          <div className="mb-3 grid grid-cols-3 gap-3">
            <Kpi label="Rows read" value={results.length} />
            <Kpi label="Valid" value={valid.length} tone="green" />
            <Kpi label="With errors" value={invalid.length} tone={invalid.length ? 'red' : 'default'} />
          </div>
          <div className="mb-2 flex gap-1">
            {(['all', 'errors', 'valid'] as const).map((k) => (
              <button key={k} onClick={() => setFilter(k)} className={clsx('rounded-full border px-3 py-0.5 text-xs font-semibold', filter === k ? 'border-transparent bg-brand text-white' : 'border-line-200 text-ink-600')}>
                {k === 'all' ? 'All rows' : k === 'errors' ? 'Errors only' : 'Valid only'}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line-200 bg-surface-50 text-ink-600">
                  {['Line', 'Property', 'Tower', 'Floor', 'Unit', 'Type', 'Occupancy', 'Occupant', 'Contact', 'Readiness', 'Validation'].map((h) => (
                    <th key={h} className="px-2 py-1.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.map((r) => (
                  <tr key={r.row.line} className={clsx('border-b border-line-100 align-top', r.errors.length ? 'bg-red-50/60' : '')}>
                    <td className="px-2 py-1.5 font-mono">{r.row.line}</td>
                    <td className="px-2 py-1.5">{r.row.propertyId}</td>
                    <td className="px-2 py-1.5">{r.row.tower}</td>
                    <td className="px-2 py-1.5">{r.row.floor}</td>
                    <td className="px-2 py-1.5 font-semibold">{r.row.unitNumber}</td>
                    <td className="px-2 py-1.5">{r.row.unitType}</td>
                    <td className="px-2 py-1.5">{r.row.occupancyStatus}</td>
                    <td className="px-2 py-1.5">{r.row.occupantName}</td>
                    <td className="px-2 py-1.5">{r.row.contact}</td>
                    <td className="px-2 py-1.5">{r.row.connectivityReadiness}</td>
                    <td className="px-2 py-1.5">
                      {r.errors.length ? (
                        <ul className="space-y-0.5 text-red-800">
                          {r.errors.map((e) => (
                            <li key={e}>✕ {e}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="font-semibold text-emerald-700">✓ Valid</span>
                      )}
                      {r.warnings.map((w) => (
                        <p key={w} className="text-amber-700">
                          ⚠ {w}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {done && (
        <Card>
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h2 className="mt-3 text-lg font-semibold text-navy">Import completed with {done.skipped ? 'partial success' : 'full success'}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {done.created} units created · {done.skipped} rows rejected
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {invalid.length > 0 && (
                <Button variant="secondary" onClick={errorReport}>
                  <Download className="h-4 w-4" /> Download error report
                </Button>
              )}
              <LinkButton to={`/mdu/units?property=${valid[0]?.row.propertyId ?? pid}`} variant="primary">
                View units
              </LinkButton>
              <Button variant="secondary" onClick={() => (setResults(null), setDone(null))}>
                Import another file
              </Button>
            </div>
          </div>
        </Card>
      )}
      <div className="mt-4">
        <SimNote>Rows are validated against your authorised properties, existing units and the file itself (duplicates). Buildings and floors that do not yet exist are created automatically.</SimNote>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Confirm import"
        body={
          <>
            Import <b>{valid.length}</b> valid units. <b>{invalid.length}</b> rows with errors will be skipped and listed in the error report.
          </>
        }
        confirmLabel="Import"
        loading={busy}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          const r = await run(() => commitImport(results!.map((v) => v.row)), (x) => `${x.created} units imported`);
          setConfirm(false);
          if (r) setDone(r);
        }}
      />
    </div>
  );
}
