import type { PlayerMatchup } from '../../utils/nhlSchedule';

import type { GroupedGame } from './types';

/** Format a countdown in seconds as `m:ss` (e.g. 65 -> "1:05"). */
export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Format a `YYYY-MM-DD` date as a short label (e.g. "Thu, Jan 15"). */
export function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Group a flat list of per-player matchups into one entry per game (keyed by
 * the two team abbrevs + game time, so a player on either side maps to the same
 * game), then sort live games first and the rest by start time.
 *
 * `liveStats` only needs each tracked player's id; a game counts as "live" when
 * any of its players currently appears in live stats.
 */
export function groupAndSortMatchups(
  matchups: PlayerMatchup[],
  liveStats: readonly { playerId: number }[],
): [string, GroupedGame][] {
  const grouped = matchups.reduce(
    (acc, matchup) => {
      // Consistent key regardless of which side the player is on.
      const teams = [matchup.teamAbbrev, matchup.opponent].sort();
      const gameKey = `${teams[0]}-${teams[1]}-${matchup.gameTime}`;

      if (!acc[gameKey]) {
        // Away team is listed first in NHL format.
        const awayTeam = matchup.isHome ? matchup.opponent : matchup.teamAbbrev;
        const homeTeam = matchup.isHome ? matchup.teamAbbrev : matchup.opponent;

        acc[gameKey] = {
          awayTeam,
          homeTeam,
          gameTime: matchup.gameTime,
          gameTimeUTC: matchup.gameTimeUTC,
          gameState: matchup.gameState,
          gameId: matchup.gameId,
          awayScore: matchup.awayScore,
          homeScore: matchup.homeScore,
          players: [],
        };
      }

      acc[gameKey].players.push(matchup);
      return acc;
    },
    {} as Record<string, GroupedGame>,
  );

  return Object.entries(grouped).sort(([, a], [, b]) => {
    const aIsLive = a.players.some((p) => liveStats.some((stat) => stat.playerId === p.playerId));
    const bIsLive = b.players.some((p) => liveStats.some((stat) => stat.playerId === p.playerId));

    if (aIsLive && !bIsLive) return -1;
    if (!aIsLive && bIsLive) return 1;

    return new Date(a.gameTimeUTC).getTime() - new Date(b.gameTimeUTC).getTime();
  });
}
