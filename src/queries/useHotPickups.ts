import { useQuery } from '@tanstack/react-query';

import { fetchHotPickups } from '../services/waiverWireService';

export function useHotPickups(leagueId: string | undefined, draftedPlayerIds: Set<number>) {
  const draftedKey = [...draftedPlayerIds].sort((a, b) => a - b).join(',');

  return useQuery({
    queryKey: ['hotPickups', leagueId, draftedKey],
    queryFn: () => fetchHotPickups(draftedPlayerIds),
    enabled: Boolean(leagueId),
    staleTime: 10 * 60 * 1000,
  });
}
