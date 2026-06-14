import { useEffect, useState } from 'react';

import { useLeague } from '../../context/LeagueContext';
import { LIVE_STATS_REFRESH_SECONDS } from '../../constants';
import { processLiveStats } from '../../utils/liveStats';

/**
 * Drives the live-stats refresh cycle: a 1s countdown plus an initial fetch and
 * a `processLiveStats` auto-refresh every `LIVE_STATS_REFRESH_SECONDS`.
 */
export function useLiveStatsRefresh() {
  const { league } = useLeague();
  const [refreshing, setRefreshing] = useState(false);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(LIVE_STATS_REFRESH_SECONDS);

  // Auto-refresh countdown timer
  useEffect(() => {
    const countdown = setInterval(() => {
      setSecondsUntilRefresh(prev => {
        if (prev <= 1) {
          return LIVE_STATS_REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, []);

  // Initial fetch + Auto-refresh live stats every 5 minutes
  useEffect(() => {
    if (!league) return;

    // Fetch immediately on mount to populate data
    const initialFetch = async () => {
      console.log('🔄 Initial live stats fetch...');
      try {
        await processLiveStats(league.id);
      } catch (error) {
        console.error('Initial fetch failed:', error);
      }
    };
    initialFetch();

    // Then auto-refresh every 5 minutes
    const autoRefresh = setInterval(async () => {
      console.log('🔄 Auto-refreshing live stats...');
      setRefreshing(true);
      try {
        await processLiveStats(league.id);
        setSecondsUntilRefresh(LIVE_STATS_REFRESH_SECONDS);
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      } finally {
        setRefreshing(false);
      }
    }, LIVE_STATS_REFRESH_SECONDS * 1000);

    return () => clearInterval(autoRefresh);
  }, [league]);

  return { refreshing, secondsUntilRefresh };
}
