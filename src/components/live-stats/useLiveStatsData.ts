import { useEffect, useState } from 'react';

import { useLeague } from '../../context/LeagueContext';
import { fetchDraftedPlayers } from '../../services/draftedPlayersService';
import {
  fetchHistoricalLiveStatsByDate,
  subscribeLiveStatsByDate,
} from '../../services/liveStatsService';
import type { LivePlayerStats } from '../../utils/liveStats';

interface UseLiveStatsDataArgs {
  selectedDate: string;
  isViewingToday: boolean;
  showAllTeams: boolean;
}

/**
 * Loads stats for the selected date: a real-time listener for today, a one-time
 * historical fetch (mapped from playerDailyScores) for past dates.
 */
export function useLiveStatsData({ selectedDate, isViewingToday, showAllTeams }: UseLiveStatsDataArgs) {
  const { league, myTeam } = useLeague();
  const [liveStats, setLiveStats] = useState<LivePlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!league) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Get drafted players to map stats to teams
    const getDraftedPlayersMap = async () => {
      const draftedPlayers = await fetchDraftedPlayers(league.id, {
        teamName: !showAllTeams && myTeam ? myTeam.teamName : undefined,
      });

      const playerMap = new Map<number, { teamName: string; nhlTeam: string; name: string; isActive: boolean }>();
      draftedPlayers.forEach((player) => {
        const slot = player.rosterSlot;
        playerMap.set(Number(player.playerId), {
          teamName: player.draftedByTeam,
          nhlTeam: player.nhlTeam,
          name: player.name,
          isActive: !slot || slot === 'active'
        });
      });
      return playerMap;
    };

    // For TODAY: Use real-time liveStats listener
    if (isViewingToday) {
      const setupListener = async () => {
        const playerMap = await getDraftedPlayersMap();
        const activePlayerIds = new Set([...playerMap.entries()].filter(([, p]) => p.isActive).map(([id]) => id));
        console.log(`📊 LiveStats: Tracking ${activePlayerIds.size} active players for date ${selectedDate}`);

        const unsubscribe = subscribeLiveStatsByDate(league.id, selectedDate, (stats) => {
          console.log(`📊 LiveStats: Found ${stats.length} matching active players for ${selectedDate}`);
          stats.sort((a, b) => b.points - a.points);
          setLiveStats(stats);
          setLastUpdate(new Date());
          setLoading(false);
        }, activePlayerIds);

        return unsubscribe;
      };

      let unsubscribe: (() => void) | null = null;
      setupListener().then(unsub => { unsubscribe = unsub; });

      return () => { if (unsubscribe) unsubscribe(); };
    }

    // For HISTORICAL dates: Fetch from playerDailyScores (one-time fetch)
    const fetchHistoricalStats = async () => {
      const playerMap = await getDraftedPlayersMap();
      console.log(`📊 LiveStats: Fetching historical stats for ${selectedDate}, playerMap size: ${playerMap.size}`);
      const historicalScores = await fetchHistoricalLiveStatsByDate(
        league.id,
        selectedDate,
        new Set(playerMap.keys()),
      );

      const stats: LivePlayerStats[] = [];
      historicalScores.forEach((data) => {
        const playerInfo = playerMap.get(data.playerId);

        if (playerInfo) {
          stats.push({
            playerId: data.playerId,
            playerName: data.playerName || playerInfo.name,
            teamName: playerInfo.teamName,
            nhlTeam: data.nhlTeam || playerInfo.nhlTeam,
            gameId: 0,
            gameState: 'FINAL',
            awayScore: 0,
            homeScore: 0,
            period: 3,
            clock: '00:00',
            goals: data.stats?.goals || 0,
            assists: data.stats?.assists || 0,
            points: data.points || 0,
            shots: data.stats?.shots || 0,
            hits: data.stats?.hits || 0,
            blockedShots: data.stats?.blockedShots || 0,
            fights: data.stats?.fights || 0,
            wins: data.stats?.wins || 0,
            saves: data.stats?.saves || 0,
            shutouts: data.stats?.shutouts || 0,
            lastUpdated: data.lastUpdated || null,
            dateKey: selectedDate,
          });
        }
      });

      console.log(`📊 LiveStats: Found ${stats.length} historical stats for ${selectedDate} (after roster filter)`);

      // Sort by points descending
      stats.sort((a, b) => b.points - a.points);

      setLiveStats(stats);
      setLastUpdate(new Date());
      setLoading(false);
    };

    fetchHistoricalStats();
  }, [league, selectedDate, isViewingToday, showAllTeams, myTeam]);

  return { liveStats, loading, lastUpdate };
}
