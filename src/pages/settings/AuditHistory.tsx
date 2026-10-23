import { useState } from 'react';
import { listAudit } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { dateTime, downloadText, toCsv } from '../../lib/format';
import { Button, DataTable, ErrorState, Loading, SearchBox, Select, Tabs } from '../../components/ui';
import { SettingsShell } from './SettingsShell';

export function AuditHistory() {
  const q = useApi(listAudit);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('All');
  if (q.error) return <ErrorState error={q.error} />;
  if (!q.data) return <Loading />;
  const rows = q.data.filter((e) => (kind === 'All' || e.entity.kind === kind) && (!search || `${e.actor} ${e.action} ${e.detail} ${e.entity.id}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <SettingsShell>
      <Tabs active="a" onChange={() => {}} tabs={[{ id: 'a', label: 'Audit History' }]} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="min-w-[220px] flex-1">
          <SearchBox value={search} onChange={setSearch} placeholder="Search actor, action or record" />
        </div>
        <Select label="Record type" value={kind} onChange={setKind} options={['All', ...new Set(q.data.map((e) => e.entity.kind))]} className="w-44" />
        <Button variant="secondary" onClick={() => downloadText('audit.csv', toCsv([['Time', 'Actor', 'Action', 'Record', 'Detail'], ...rows.map((e) => [e.at, e.actor, e.action, `${e.entity.kind}:${e.entity.id}`, e.detail])]))}>
          Export
        </Button>
      </div>
      <DataTable
        rows={rows}
        rowKey={(e) => e.id}
        pageSize={15}
        mobileTitle={(e) => e.action}
        empty="No audit events in your scope"
        columns={[
          { key: 't', header: 'Time', render: (e) => <span className="whitespace-nowrap text-xs">{dateTime(e.at)}</span>, sort: (e) => e.at },
          { key: 'a', header: 'Actor', render: (e) => e.actor, sort: (e) => e.actor },
          { key: 'x', header: 'Action', render: (e) => <span className="font-semibold text-navy">{e.action}</span>, mobileHidden: true },
          { key: 'r', header: 'Record', render: (e) => <span className="font-mono text-xs">{e.entity.id}</span> },
          { key: 'd', header: 'Detail', render: (e) => <span className="text-xs">{e.detail}</span> },
        ]}
      />
    </SettingsShell>
  );
}
