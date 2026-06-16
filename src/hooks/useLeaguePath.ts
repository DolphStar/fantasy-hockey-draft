import { useParams } from 'react-router-dom';

import { buildLeaguePath } from '../lib/leaguePaths';

/**
 * Returns a builder that prefixes a subpath with the active league route.
 * Usage: const leaguePath = useLeaguePath(); navigate(leaguePath('scores'));
 */
export function useLeaguePath(): (sub?: string) => string {
  const { leagueId } = useParams<{ leagueId: string }>();
  return (sub?: string) => buildLeaguePath(leagueId ?? '', sub);
}
