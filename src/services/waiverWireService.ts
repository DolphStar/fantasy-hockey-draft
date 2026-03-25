import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from '../firebase';

export interface HotPickupData {
  id: number;
  name: string;
  team: string;
  position: string;
  points: number;
  trend: 'rising' | 'steady' | 'cooling';
  percentRostered: number;
  headshot?: string;
}

function getTrend(points: number): HotPickupData['trend'] {
  if (points >= 15) {
    return 'rising';
  }
  if (points >= 8) {
    return 'steady';
  }
  return 'cooling';
}

interface WeeklyPlayerEntry {
  id: number;
  name: string;
  team: string;
  pos: string;
  fp?: number;
}

interface SeasonApiPlayer {
  playerId: number;
  name: string;
  team: string;
  position: string;
  points: number;
}

interface SeasonApiResponse {
  players?: SeasonApiPlayer[];
}

function getSevenDaysAgoDateString() {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  return sevenDaysAgo.toISOString().split('T')[0];
}

export async function fetchHotPickups(
  draftedPlayerIds: Set<number>,
): Promise<{ items: HotPickupData[]; label: string }> {
  const dateStr = getSevenDaysAgoDateString();
  const snapshot = await getDocs(
    query(collection(db, 'nhl_daily_stats'), where('date', '>=', dateStr)),
  );

  const playerTotals = new Map<number, { id: number; name: string; team: string; position: string; points: number; games: number }>();
  let hasFirestoreData = false;

  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data() as { players?: Record<string, WeeklyPlayerEntry> };
    if (!data.players) {
      return;
    }

    hasFirestoreData = true;
    Object.values(data.players).forEach((player) => {
      if (draftedPlayerIds.has(player.id)) {
        return;
      }

      const existing = playerTotals.get(player.id) ?? {
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.pos,
        points: 0,
        games: 0,
      };

      existing.points += player.fp ?? 0;
      existing.games += 1;
      playerTotals.set(player.id, existing);
    });
  });

  if (hasFirestoreData) {
    const items = Array.from(playerTotals.values())
      .filter((player) => player.points > 0)
      .map((player) => ({
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        points: Number(player.points.toFixed(1)),
        trend: getTrend(player.points),
        percentRostered: Math.round(Math.random() * 40 + 10),
        headshot: `https://assets.nhle.com/mugs/nhl/20242025/${player.team}/${player.id}.png`,
      }))
      .sort((left, right) => right.points - left.points)
      .slice(0, 6);

    return { items, label: 'Last 7 Days' };
  }

  const response = await fetch('/api/current-season-stats');
  if (!response.ok) {
    throw new Error(`Season API failed with status ${response.status}`);
  }

  const data = (await response.json()) as SeasonApiResponse;
  const items = (data.players ?? [])
    .filter((player) => !draftedPlayerIds.has(player.playerId))
    .slice(0, 6)
    .map((player) => ({
      id: player.playerId,
      name: player.name,
      team: player.team,
      position: player.position,
      points: player.points,
      trend: player.points >= 25 ? 'rising' : 'steady' as HotPickupData['trend'],
      percentRostered: Math.round(Math.random() * 40 + 10),
      headshot: `https://assets.nhle.com/mugs/nhl/20242025/${player.team}/${player.playerId}.png`,
    }));

  return { items, label: 'Season Leaders' };
}
