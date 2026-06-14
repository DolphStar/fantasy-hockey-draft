import type { PlayerMatchup } from '../../utils/nhlSchedule';

/**
 * A single NHL game with the current user's roster players grouped onto it.
 * Built from a flat list of {@link PlayerMatchup} by `groupAndSortMatchups`.
 */
export interface GroupedGame {
  awayTeam: string;
  homeTeam: string;
  gameTime: string;
  gameTimeUTC: string;
  gameState: string;
  gameId: number;
  awayScore?: number;
  homeScore?: number;
  players: PlayerMatchup[];
}
