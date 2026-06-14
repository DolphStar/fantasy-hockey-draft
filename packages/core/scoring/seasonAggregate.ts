import type { AggregatedPlayerScore } from './aggregateDailyScores.js';

export interface PlayerSeasonStats {
  points: number;
  goals: number;
  assists: number;
  gamesPlayed: number;
  recent: { date: string; points: number }[];
}

export interface TeamSeasonAggregate {
  teamName: string;
  players: Record<number, PlayerSeasonStats>;
  dailyTotals: { date: string; points: number }[];
}

export interface PlayerPerformanceSummary {
  pointsMap: Record<number, number>;
  statsMap: Record<number, { goals: number; assists: number; gamesPlayed: number; avgPoints: number }>;
  historyMap: Record<number, { date: string; points: number }[]>;
  dailyTeamTotals: { date: string; points: number }[];
  lastGamePoints: number;
  trend: 'up' | 'down' | 'neutral';
}

const RECENT_LIMIT = 5;

const byDateAsc = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);

/**
 * Fold positive-point player scores for ONE team into its season aggregate.
 * `prev` is the existing aggregate (or null to start empty). `scores` may span
 * a single day (incremental cron) or the whole season (bootstrap / reader
 * fallback). Mirrors the legacy full-scan reader exactly: gamesPlayed counts
 * one per positive-point performance, recent keeps the last 5 days by date, and
 * dailyTotals sums positive performances per day.
 */
export function foldDailyScores(
  prev: TeamSeasonAggregate | null,
  teamName: string,
  scores: AggregatedPlayerScore[],
): TeamSeasonAggregate {
  const players: Record<number, PlayerSeasonStats> = {};
  if (prev) {
    for (const [id, stats] of Object.entries(prev.players)) {
      players[Number(id)] = { ...stats, recent: [...stats.recent] };
    }
  }

  const dailyTotals = new Map<string, number>();
  if (prev) {
    for (const entry of prev.dailyTotals) dailyTotals.set(entry.date, entry.points);
  }

  for (const score of scores) {
    const existing = players[score.playerId];
    if (existing) {
      existing.points += score.points;
      existing.goals += score.stats.goals ?? 0;
      existing.assists += score.stats.assists ?? 0;
      existing.gamesPlayed += 1;
      existing.recent.push({ date: score.date, points: score.points });
    } else {
      players[score.playerId] = {
        points: score.points,
        goals: score.stats.goals ?? 0,
        assists: score.stats.assists ?? 0,
        gamesPlayed: 1,
        recent: [{ date: score.date, points: score.points }],
      };
    }

    dailyTotals.set(score.date, (dailyTotals.get(score.date) ?? 0) + score.points);
  }

  for (const stats of Object.values(players)) {
    stats.recent.sort(byDateAsc);
    if (stats.recent.length > RECENT_LIMIT) {
      stats.recent = stats.recent.slice(-RECENT_LIMIT);
    }
  }

  return {
    teamName,
    players,
    dailyTotals: Array.from(dailyTotals.entries())
      .map(([date, points]) => ({ date, points }))
      .sort(byDateAsc),
  };
}

/** Build a team aggregate from scratch (bootstrap / reader fallback). */
export function buildTeamAggregate(
  teamName: string,
  scores: AggregatedPlayerScore[],
): TeamSeasonAggregate {
  return foldDailyScores(null, teamName, scores);
}

/** Produce the dashboard summary from a team aggregate. */
export function summaryFromAggregate(agg: TeamSeasonAggregate): PlayerPerformanceSummary {
  const pointsMap: PlayerPerformanceSummary['pointsMap'] = {};
  const statsMap: PlayerPerformanceSummary['statsMap'] = {};
  const historyMap: PlayerPerformanceSummary['historyMap'] = {};

  for (const [id, stats] of Object.entries(agg.players)) {
    const playerId = Number(id);
    pointsMap[playerId] = stats.points;
    statsMap[playerId] = {
      goals: stats.goals,
      assists: stats.assists,
      gamesPlayed: stats.gamesPlayed,
      avgPoints: stats.gamesPlayed > 0 ? stats.points / stats.gamesPlayed : 0,
    };
    historyMap[playerId] = stats.recent.map((item) => ({ date: item.date, points: item.points }));
  }

  const dailyTeamTotals = [...agg.dailyTotals].sort(byDateAsc);
  const lastGamePoints = dailyTeamTotals.at(-1)?.points ?? 0;
  const previousGamePoints = dailyTeamTotals.at(-2)?.points;

  return {
    pointsMap,
    statsMap,
    historyMap,
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
