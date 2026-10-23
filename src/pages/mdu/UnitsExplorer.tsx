import { useSearchParams } from 'react-router-dom';
import { getProperty, listProperties } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { Card, ErrorState, Loading, PageHeader, Select } from '../../components/ui';
import { BuildingsUnits } from './BuildingsUnits';

export function UnitsExplorer() {
  const props = useApi(listProperties);
  const [params, setParams] = useSearchParams();
  const pid = params.get('property') ?? props.data?.[0]?.id ?? '';
  const detail = useApi(() => (pid ? getProperty(pid) : Promise.resolve(null)), [pid]);
  if (props.error) return <ErrorState error={props.error} />;
  if (!props.data) return <Loading />;
  if (!props.data.length) return <PageHeader title="Buildings, Towers & Units" subtitle="No properties in your scope." />;
  return (
    <div>
      <PageHeader
        title="Buildings, Towers & Units"
        subtitle="Property → Building / Tower → Floor → Unit. Connectivity and occupancy are shown independently."
        crumbs={[{ label: 'MDU Portfolio', to: '/mdu' }, { label: 'Buildings / Towers / Units' }]}
        actions={<Select label="Property" value={pid} onChange={(v) => setParams({ property: v })} options={props.data.map((p) => ({ value: p.id, label: `${p.name} (${p.city})` }))} className="w-72" />}
      />
      <Card>{detail.data ? <BuildingsUnits key={pid} propertyId={pid} buildings={detail.data.buildings} /> : detail.error ? <ErrorState error={detail.error} /> : <Loading />}</Card>
    </div>
  );
}
