import { useQuery } from '@tanstack/react-query';
import { getTeamRoster, type TeamAbbrev } from '../utils/nhlApi';

/**
 * Query hook for fetching NHL team rosters
 * 
 * Features:
 * - Cached for 10 minutes per team
 * - Switching between teams uses cache (instant!)
 * - Auto-refetch on stale data
 * - Only fetches when teamAbbrev is provided
 */
export function useTeamRoster(teamAbbrev: TeamAbbrev | null) {
  return useQuery({
    queryKey: ['roster', teamAbbrev],
    queryFn: () => getTeamRoster(teamAbbrev!),
    enabled: !!teamAbbrev, // Only fetch if teamAbbrev exists
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
  });
}
