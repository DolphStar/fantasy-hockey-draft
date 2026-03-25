import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';

import { db } from '../firebase';
import type { LivePlayerStats } from '../utils/liveStats';

export function subscribeLiveStatsByDate(
  leagueId: string,
  dateKey: string,
  onStats: (stats: LivePlayerStats[]) => void,
  filterPlayerIds?: Set<number>,
) {
  return onSnapshot(query(collection(db, `leagues/${leagueId}/liveStats`)), (snapshot) => {
    const stats: LivePlayerStats[] = [];

    snapshot.forEach((docSnapshot) => {
      if (!docSnapshot.id.startsWith(dateKey)) {
        return;
      }

      const data = docSnapshot.data() as LivePlayerStats;
      if (filterPlayerIds && !filterPlayerIds.has(data.playerId)) {
        return;
      }

      stats.push(data);
    });

    onStats(stats);
  });
}

interface HistoricalLiveStatRecord {
  playerId: number;
  playerName?: string;
  nhlTeam?: string;
  points?: number;
  stats?: {
    goals?: number;
    assists?: number;
    shots?: number;
    hits?: number;
    blockedShots?: number;
    fights?: number;
    wins?: number;
    saves?: number;
    shutouts?: number;
  };
  lastUpdated?: string | null;
}

export async function fetchHistoricalLiveStatsByDate(
  leagueId: string,
  dateKey: string,
  filterPlayerIds?: Set<number>,
): Promise<HistoricalLiveStatRecord[]> {
  const snapshot = await getDocs(
    query(collection(db, `leagues/${leagueId}/playerDailyScores`), where('date', '==', dateKey)),
  );

  const records: HistoricalLiveStatRecord[] = [];

  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data() as HistoricalLiveStatRecord;
    if (filterPlayerIds && !filterPlayerIds.has(data.playerId)) {
      return;
    }

    records.push(data);
  });

  return records;
}

export function subscribeLiveStatPlayerIdsByDate(
  leagueId: string,
  dateKey: string,
  onPlayerIds: (playerIds: Set<string>) => void,
) {
  return onSnapshot(query(collection(db, `leagues/${leagueId}/liveStats`)), (snapshot) => {
    const playerIds = new Set<string>();

    snapshot.forEach((docSnapshot) => {
      if (!docSnapshot.id.startsWith(dateKey)) {
        return;
      }

      const data = docSnapshot.data() as { playerId?: number | string };
      if (data.playerId !== undefined) {
        playerIds.add(String(data.playerId));
      }
    });

    onPlayerIds(playerIds);
  });
}
