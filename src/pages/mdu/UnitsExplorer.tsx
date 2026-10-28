import { Navigate, useSearchParams } from 'react-router-dom';
import { listProperties } from '../../api/api';
import { useApi } from '../../lib/hooks';
import { ErrorState, Loading, PageHeader } from '../../components/ui';

/**
 * "Buildings / Towers / Units" opens the Buildings & Units tab of the chosen
 * property, so there is a single unit explorer (with a property switcher).
 */
export function UnitsExplorer() {
  const props = useApi(listProperties);
  const [params] = useSearchParams();
  if (props.error) return <ErrorState error={props.error} />;
  if (!props.data) return <Loading />;
  const pid = params.get('property') ?? props.data[0]?.id;
  if (!pid) return <PageHeader title="Buildings, Towers & Units" subtitle="No properties in your scope." />;
  return <Navigate to={`/mdu/${pid}?tab=units`} replace />;
}
