/**
 * Hoisted NHL game-data fetch for a single date. Fetched ONCE per scoring run
 * and shared across all leagues (per-league `allowedGameTypes` filtering happens
 * later in `scoreLeagueForDate`).
 */

import type { PlayerGameStats } from '../../../packages/core/nhl/types.js';

import { mapWithConcurrency } from '../concurrency.js';
import {
  getAllPlayersFromBoxscore,
  getGameBoxscore,
  getGamePlayByPlay,
  getGamesForDate,
} from '../nhl/webClient.js';
import { isCompletedGame } from './helpers.js';

const GAME_FETCH_CONCURRENCY = 4;

export interface DailyGameStats {
  gameId: number;
  gameType: number;
  players: PlayerGameStats[];
}

/** Parse fighting penalties from a game's play-by-play into per-player counts. */
export function countFightsFromPlayByPlay(playByPlay: unknown): Map<number, number> {
  const fightCounts = new Map<number, number>();

  try {
    const plays = (playByPlay as { plays?: unknown[] })?.plays || [];

    for (const play of plays) {
      const p = play as {
        typeDescKey?: string;
        details?: { descKey?: string; committedByPlayerId?: number };
      };
      if (p.typeDescKey === 'penalty' && p.details?.descKey === 'fighting') {
        const playerId = p.details.committedByPlayerId;
        if (playerId) {
          fightCounts.set(playerId, (fightCounts.get(playerId) || 0) + 1);
        }
      }
    }
  } catch (error) {
    console.error('Error parsing play-by-play for fights:', error);
  }

  return fightCounts;
}

/** Pure: keep only games whose gameType is in `allowedGameTypes`. */
export function filterGameStatsByType(
  games: DailyGameStats[],
  allowedGameTypes: number[],
): { included: DailyGameStats[]; skippedTypeCount: number } {
  const included = games.filter((g) => allowedGameTypes.includes(g.gameType));
  return { included, skippedTypeCount: games.length - included.length };
}

/**
 * Fetch boxscore + play-by-play for every completed game on `date` (all game
 * types). Per-game fetch failures are swallowed and yield an empty player list
 * for that game, matching the previous single-league behavior.
 */
export async function fetchDailyGameStats(date: string): Promise<DailyGameStats[]> {
  const games = await getGamesForDate(date);
  const completed = games.filter((g) => isCompletedGame(g));

  return mapWithConcurrency(completed, GAME_FETCH_CONCURRENCY, async (game) => {
    try {
      const boxscore = await getGameBoxscore(game.id);
      const playByPlay = await getGamePlayByPlay(game.id);
      const fightCounts = countFightsFromPlayByPlay(playByPlay);

      const players = getAllPlayersFromBoxscore(boxscore);
      players.forEach((p) => {
        p.fights = fightCounts.get(p.playerId) || 0;
      });

      return { gameId: game.id, gameType: game.gameType, players };
    } catch (error) {
      console.error(`Error processing game ${game.id}:`, error);
      return { gameId: game.id, gameType: game.gameType, players: [] as PlayerGameStats[] };
    }
  });
}
