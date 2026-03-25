/**
 * Pure helpers for server scoring orchestration (testable without Firestore).
 */

/** JavaScript Sunday = 0 … Saturday = 6 (uses the host timezone of the given `Date`). */
export function isRosterSwapDayOfWeek(dayOfWeek: number): boolean {
  return dayOfWeek === 6;
}

export interface GameForScoringFilter {
  gameState: string;
  gameType: number;
  id: number;
}

export function filterCompletedGamesForScoring<T extends GameForScoringFilter>(
  games: T[],
  allowedGameTypes: number[],
): { completedGames: T[]; skippedByType: T[] } {
  const isCompleted = (g: T) => g.gameState === 'OFF' || g.gameState === 'FINAL';

  const completedGames = games.filter(
    (g) => isCompleted(g) && allowedGameTypes.includes(g.gameType),
  );
  const skippedByType = games.filter(
    (g) => isCompleted(g) && !allowedGameTypes.includes(g.gameType),
  );

  return { completedGames, skippedByType };
}

export interface DraftedPlayerRow {
  playerId: unknown;
  rosterSlot: unknown;
  draftedByTeam: unknown;
}

/**
 * Mirrors `src/utils/scoringEngine` roster mapping: active roster only, with reserve count.
 */
export function buildActivePlayerToTeamMap(
  rows: DraftedPlayerRow[],
): { playerToTeamMap: Map<number, string>; reserveCount: number } {
  const playerToTeamMap = new Map<number, string>();
  let reserveCount = 0;

  for (const data of rows) {
    if (data.rosterSlot === 'active') {
      playerToTeamMap.set(data.playerId as number, data.draftedByTeam as string);
    } else {
      reserveCount++;
    }
  }

  return { playerToTeamMap, reserveCount };
}
