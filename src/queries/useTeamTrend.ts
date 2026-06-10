import { useQuery } from '@tanstack/react-query';

import { fetchTeamTrend } from '../services/playerPerformanceService';

export function useTeamTrend(
  leagueId: string | undefined,
  teamName: string | undefined,
  teamCount: number,
  maxDays: number,
) {
  return useQuery({
    queryKey: ['teamTrend', leagueId, teamName, teamCount, maxDays],
    queryFn: () => fetchTeamTrend(leagueId!, teamName!, teamCount, maxDays),
    enabled: Boolean(leagueId && teamName),
    staleTime: 5 * 60 * 1000,
  });
}
