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
 * per-player daily score records. Undrafted players are ignored, non-finite
 * point results are skipped, and player score records are only emitted for
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

  for (const gamePlayers of playersByGame) {
    for (const playerStats of gamePlayers) {
      const fantasyTeam = playerToTeamMap.get(playerStats.playerId);
      if (!fantasyTeam) continue;

      const points = calculatePlayerPoints(playerStats, rules);
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
