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

/** A game is scorable once it is OFF (final) or FINAL. */
export function isCompletedGame(game: { gameState: string }): boolean {
  return game.gameState === 'OFF' || game.gameState === 'FINAL';
}

export function filterCompletedGamesForScoring<T extends GameForScoringFilter>(
  games: T[],
  allowedGameTypes: number[],
): { completedGames: T[]; skippedByType: T[] } {
  const completedGames = games.filter(
    (g) => isCompletedGame(g) && allowedGameTypes.includes(g.gameType),
  );
  const skippedByType = games.filter(
    (g) => isCompletedGame(g) && !allowedGameTypes.includes(g.gameType),
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
