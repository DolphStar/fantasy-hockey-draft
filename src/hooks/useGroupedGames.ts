import { useMemo } from 'react';

interface Game {
  id: number;
  startTimeUTC: string;
  gameState: string;
  awayTeam: { abbrev: string; score?: number };
  homeTeam: { abbrev: string; score?: number };
  period?: number;
  clock?: { timeRemaining?: string };
}

interface Player {
  playerId: number;
  name: string;
  nhlTeam: string;
  teamAbbrev?: string;
  rosterSlot?: string;
}

export interface GameWithPlayers extends Game {
  fantasyPlayers: Player[];
}

interface GroupedGames {
  live: GameWithPlayers[];
  upcoming: GameWithPlayers[];
  finished: GameWithPlayers[];
}

/**
 * Groups today's games by state (live, upcoming, finished) and attaches fantasy players
 */
export function useGroupedGames(
  roster: Player[] | undefined,
  todaysGames: Game[] | undefined
): GroupedGames {
  return useMemo(() => {
    if (!todaysGames || !roster) {
      return { live: [], upcoming: [], finished: [] };
    }

    // Helper to find players in a specific game
    const getPlayersInGame = (homeTeam: string, awayTeam: string): Player[] => {
      return roster.filter(
        p => p.teamAbbrev === homeTeam || p.teamAbbrev === awayTeam
      );
    };

    const live: GameWithPlayers[] = [];
    const upcoming: GameWithPlayers[] = [];
    const finished: GameWithPlayers[] = [];

    todaysGames.forEach(game => {
      const playersInGame = getPlayersInGame(
        game.homeTeam.abbrev,
        game.awayTeam.abbrev
      );

      // Skip games where user has no players (reduces clutter)
      if (playersInGame.length === 0) return;

      const gameWithPlayers: GameWithPlayers = {
        ...game,
        fantasyPlayers: playersInGame
      };

      // Sort into buckets based on NHL API gameState
      // LIVE, CRIT = In progress
      // FUT, PRE = Not started yet
      // FINAL, OFF = Completed
      if (['LIVE', 'CRIT'].includes(game.gameState)) {
        live.push(gameWithPlayers);
      } else if (['FUT', 'PRE'].includes(game.gameState)) {
        upcoming.push(gameWithPlayers);
      } else if (['FINAL', 'OFF'].includes(game.gameState)) {
        finished.push(gameWithPlayers);
      }
    });

    // Sort upcoming by start time
    upcoming.sort(
      (a, b) =>
        new Date(a.startTimeUTC).getTime() - new Date(b.startTimeUTC).getTime()
    );

    return { live, upcoming, finished };
  }, [roster, todaysGames]);
}
