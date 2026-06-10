import type { PlayerGameStats } from '../nhl/types.js';

import { calculatePlayerPoints } from './scoringMath.js';
import type { ScoringRules } from './types.js';

export interface AggregatedPlayerScore {
  playerId: number;
  playerName: string;
  teamName: string;
  nhlTeam: string;
  date: string;
  points: number;
  stats: Record<string, number>;
}

export interface DailyScoreAggregation {
  teamPoints: Map<string, number>;
  playerScores: AggregatedPlayerScore[];
}

const TRACKED_STAT_KEYS = [
  'goals',
  'assists',
  'shots',
  'hits',
  'blockedShots',
  'pim',
  'wins',
  'saves',
  'shutouts',
] as const;

/**
 * Pure aggregation of per-game player stats into fantasy team totals and
 * per-player daily score records. Mirrors the historical behavior of
 * `processYesterdayScores`: undrafted players are ignored, non-finite point
 * results are skipped, and player score records are only emitted for
 * positive-point performances.
 */
export function aggregateDailyScores(
  playersByGame: PlayerGameStats[][],
  playerToTeamMap: Map<number, string>,
  rules: ScoringRules,
  date: string,
): DailyScoreAggregation {
  const teamPoints = new Map<string, number>();
  const playerScores: AggregatedPlayerScore[] = [];

  // Sanitize rules so that NaN/Infinity rule values don't poison the entire
  // player calculation when a stat is absent (e.g. 0 * NaN = NaN). Any
  // non-finite rule value is replaced with 0 so only stats that actually
  // apply a finite multiplier contribute to a player's total.
  const safeRules = Object.fromEntries(
    Object.entries(rules).map(([k, v]) => [k, Number.isFinite(v as number) ? v : 0]),
  ) as ScoringRules;

  for (const gamePlayers of playersByGame) {
    for (const playerStats of gamePlayers) {
      const fantasyTeam = playerToTeamMap.get(playerStats.playerId);
      if (!fantasyTeam) continue;

      const points = calculatePlayerPoints(playerStats, safeRules);
      if (!Number.isFinite(points)) continue;

      teamPoints.set(fantasyTeam, (teamPoints.get(fantasyTeam) ?? 0) + points);

      if (points > 0) {
        const stats: Record<string, number> = {};
        for (const key of TRACKED_STAT_KEYS) {
          const value = playerStats[key];
          if (value !== undefined) stats[key] = value;
        }

        playerScores.push({
          playerId: playerStats.playerId,
          playerName: playerStats.name.default,
          teamName: fantasyTeam,
          nhlTeam: playerStats.teamAbbrev || 'UNK',
          date,
          points,
          stats,
        });
      }
    }
  }

  return { teamPoints, playerScores };
}
