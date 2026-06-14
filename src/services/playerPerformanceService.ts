import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';

import { db } from '../firebase';
import type { AggregatedPlayerScore } from '../../packages/core/scoring/aggregateDailyScores';
import {
  buildTeamAggregate,
  summaryFromAggregate,
  type PlayerPerformanceSummary,
  type TeamSeasonAggregate,
} from '../../packages/core/scoring/seasonAggregate';

export type { PlayerPerformanceSummary };

export interface TeamTrendPoint {
  date: string;
  myTeam: number;
  leagueAvg: number;
}

export async function fetchPlayerPerformanceSummary(
  leagueId: string,
  teamName: string,
): Promise<PlayerPerformanceSummary> {
  const aggregateSnap = await getDoc(doc(db, `leagues/${leagueId}/aggregates/${teamName}`));
  if (aggregateSnap.exists()) {
    return summaryFromAggregate(aggregateSnap.data() as TeamSeasonAggregate);
  }

  // Fallback when no aggregate exists yet (fresh league, just-cleared, or the
  // window before the first cron run): scan once and build it in memory through
  // the same pure path, so output is identical to the fast path.
  const snapshot = await getDocs(query(collection(db, `leagues/${leagueId}/playerDailyScores`)));
  const teamScores = snapshot.docs
    .map((docSnapshot) => docSnapshot.data() as AggregatedPlayerScore)
    .filter((score) => score.teamName === teamName);

  return summaryFromAggregate(buildTeamAggregate(teamName, teamScores));
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

const TREND_SCORE_DOC_LIMIT = 500;

export async function fetchTeamTrend(
  leagueId: string,
  teamName: string,
  teamCount: number,
  maxDays: number,
): Promise<TeamTrendPoint[]> {
  const snapshot = await getDocs(
    query(
      collection(db, `leagues/${leagueId}/playerDailyScores`),
      orderBy('date', 'desc'),
      limit(TREND_SCORE_DOC_LIMIT),
    ),
  );
  const map = new Map<string, { total: number; myPoints: number }>();

  snapshot.docs.forEach((docSnapshot) => {
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
