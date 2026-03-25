import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { db } from '../firebase';

export interface PlayerPerformanceSummary {
  pointsMap: Record<number, number>;
  statsMap: Record<number, { goals: number; assists: number; gamesPlayed: number; avgPoints: number }>;
  historyMap: Record<number, { date: string; points: number }[]>;
  dailyTeamTotals: { date: string; points: number }[];
  lastGamePoints: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface TeamTrendPoint {
  date: string;
  myTeam: number;
  leagueAvg: number;
}

export async function fetchPlayerPerformanceSummary(
  leagueId: string,
  teamName: string,
): Promise<PlayerPerformanceSummary> {
  const snapshot = await getDocs(query(collection(db, `leagues/${leagueId}/playerDailyScores`)));

  const pointsMap: Record<number, number> = {};
  const statsMap: Record<number, { goals: number; assists: number; gamesPlayed: number; avgPoints: number }> = {};
  const historyMap: Record<number, { date: string; points: number }[]> = {};
  const dailyTotalsMap: Record<string, number> = {};

  snapshot.docs.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    const playerId = data.playerId as number;
    const points = data.points || 0;
    const date = data.date as string;
    const scoreTeamName = data.teamName as string;

    if (pointsMap[playerId]) {
      pointsMap[playerId] += points;
      statsMap[playerId].goals += data.stats?.goals || 0;
      statsMap[playerId].assists += data.stats?.assists || 0;
      statsMap[playerId].gamesPlayed += 1;
    } else {
      pointsMap[playerId] = points;
      statsMap[playerId] = {
        goals: data.stats?.goals || 0,
        assists: data.stats?.assists || 0,
        gamesPlayed: 1,
        avgPoints: 0,
      };
    }

    historyMap[playerId] ||= [];
    historyMap[playerId].push({ date, points });

    if (scoreTeamName === teamName) {
      dailyTotalsMap[date] = (dailyTotalsMap[date] ?? 0) + points;
    }
  });

  Object.keys(statsMap).forEach((playerId) => {
    const numericPlayerId = Number(playerId);
    const gamesPlayed = statsMap[numericPlayerId].gamesPlayed;
    statsMap[numericPlayerId].avgPoints = gamesPlayed > 0 ? pointsMap[numericPlayerId] / gamesPlayed : 0;
  });

  const processedHistory: Record<number, { points: number; date: string }[]> = {};
  Object.keys(historyMap).forEach((playerId) => {
    processedHistory[Number(playerId)] = historyMap[Number(playerId)]
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-5)
      .map((item) => ({ points: item.points, date: item.date }));
  });

  const sortedDates = Object.keys(dailyTotalsMap).sort();
  const dailyTeamTotals = sortedDates.map((date) => ({ date, points: dailyTotalsMap[date] }));
  const lastGamePoints = dailyTeamTotals.at(-1)?.points ?? 0;
  const previousGamePoints = dailyTeamTotals.at(-2)?.points;

  return {
    pointsMap,
    statsMap,
    historyMap: processedHistory,
    dailyTeamTotals,
    lastGamePoints,
    trend:
      previousGamePoints === undefined
        ? 'neutral'
        : lastGamePoints > previousGamePoints
          ? 'up'
          : lastGamePoints < previousGamePoints
            ? 'down'
            : 'neutral',
  };
}

export async function fetchTeamStanding(leagueId: string, teamName: string) {
  const snapshot = await getDocs(
    query(collection(db, `leagues/${leagueId}/teamScores`), orderBy('totalPoints', 'desc')),
  );

  const teams = snapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    totalPoints: docSnapshot.data().totalPoints || 0,
    teamName: docSnapshot.data().teamName as string,
  }));

  const teamIndex = teams.findIndex((team) => team.teamName === teamName);
  return teamIndex === -1
    ? { rank: teams.length + 1, totalPoints: 0 }
    : { rank: teamIndex + 1, totalPoints: teams[teamIndex].totalPoints };
}

export async function fetchTeamTrend(
  leagueId: string,
  teamName: string,
  teamCount: number,
  maxDays: number,
): Promise<TeamTrendPoint[]> {
  const snapshot = await getDocs(
    query(collection(db, `leagues/${leagueId}/playerDailyScores`), orderBy('date', 'desc')),
  );
  const map = new Map<string, { total: number; myPoints: number }>();

  snapshot.docs.slice(0, 500).forEach((docSnapshot) => {
    const data = docSnapshot.data() as { date: string; points: number; teamName: string };
    if (!map.has(data.date)) {
      map.set(data.date, { total: 0, myPoints: 0 });
    }

    const entry = map.get(data.date)!;
    entry.total += data.points;
    if (data.teamName === teamName) {
      entry.myPoints += data.points;
    }
  });

  return Array.from(map.keys())
    .sort()
    .slice(-maxDays)
    .map((date) => {
      const entry = map.get(date)!;
      const avg = entry.total / Math.max(teamCount, 1);

      return {
        date,
        myTeam: Number(entry.myPoints.toFixed(1)),
        leagueAvg: Number(avg.toFixed(1)),
      };
    });
}
