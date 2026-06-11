import { useQuery } from '@tanstack/react-query';

import { fetchTodaySchedule } from '../utils/nhlSchedule';

export function useTodaySchedule(allowedGameTypes: number[]) {
  return useQuery({
    queryKey: ['todaySchedule', allowedGameTypes],
    queryFn: () => fetchTodaySchedule(allowedGameTypes),
    staleTime: 5 * 60 * 1000,
  });
}
