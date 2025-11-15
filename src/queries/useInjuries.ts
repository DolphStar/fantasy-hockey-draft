import { useQuery } from '@tanstack/react-query';
import { fetchAllInjuries } from '../services/injuryService';

/**
 * Query hook for fetching NHL injury data from ESPN
 * 
 * Features:
 * - Cached for 5 minutes across all components
 * - Auto-refetches every 5 minutes in background
 * - Shared state - fetch once, use everywhere
 * - Automatic loading/error states
 */
export function useInjuries() {
  return useQuery({
    queryKey: ['injuries'],
    queryFn: fetchAllInjuries,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes
  });
}
