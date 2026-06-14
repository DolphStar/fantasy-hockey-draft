import { describe, expect, it } from 'vitest';

import type { PlayerMatchup } from '../../utils/nhlSchedule';

import { formatCountdown, formatDisplayDate, groupAndSortMatchups } from './liveStatsUtils';

function matchup(o: Partial<PlayerMatchup> & { playerId: number }): PlayerMatchup {
  return {
    playerName: `Player ${o.playerId}`,
    teamAbbrev: 'EDM',
    opponent: 'COL',
    isHome: true,
    gameTime: '7:00 PM',
    gameTimeUTC: '2026-01-15T00:00:00Z',
    gameState: 'FUT',
    gameId: 1,
    ...o,
  };
}

describe('formatCountdown', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(300)).toBe('5:00');
    expect(formatCountdown(9)).toBe('0:09');
    expect(formatCountdown(0)).toBe('0:00');
  });
});

describe('formatDisplayDate', () => {
  it('renders a short weekday/month/day label at local noon (tz-stable)', () => {
    expect(formatDisplayDate('2026-01-15')).toBe('Thu, Jan 15');
  });
});

describe('groupAndSortMatchups', () => {
  it('groups two players on the same game into one entry', () => {
    const result = groupAndSortMatchups(
      [
        matchup({ playerId: 1, teamAbbrev: 'EDM', opponent: 'COL', isHome: true, gameId: 10 }),
        matchup({ playerId: 2, teamAbbrev: 'COL', opponent: 'EDM', isHome: false, gameId: 10 }),
      ],
      [],
    );

    expect(result).toHaveLength(1);
    const [, game] = result[0];
    expect(game.players.map((p) => p.playerId)).toEqual([1, 2]);
    // away listed first in NHL format; player 1 is home (EDM) so away is COL
    expect(game.awayTeam).toBe('COL');
    expect(game.homeTeam).toBe('EDM');
  });

  it('keeps separate games separate', () => {
    const result = groupAndSortMatchups(
      [
        matchup({ playerId: 1, teamAbbrev: 'EDM', opponent: 'COL', gameTime: '7:00 PM' }),
        matchup({ playerId: 2, teamAbbrev: 'BOS', opponent: 'NYR', gameTime: '8:00 PM' }),
      ],
      [],
    );
    expect(result).toHaveLength(2);
  });

  it('sorts live games before non-live, then by start time', () => {
    const result = groupAndSortMatchups(
      [
        matchup({
          playerId: 1,
          teamAbbrev: 'EDM',
          opponent: 'COL',
          gameTime: '10:00 PM',
          gameTimeUTC: '2026-01-15T03:00:00Z',
        }),
        matchup({
          playerId: 2,
          teamAbbrev: 'BOS',
          opponent: 'NYR',
          gameTime: '7:00 PM',
          gameTimeUTC: '2026-01-15T00:00:00Z',
        }),
      ],
      [{ playerId: 1 }], // player 1's game is live despite a later start time
    );

    expect(result[0][1].players[0].playerId).toBe(1);
    expect(result[1][1].players[0].playerId).toBe(2);
  });

  it('sorts purely by start time when none are live', () => {
    const result = groupAndSortMatchups(
      [
        matchup({
          playerId: 1,
          teamAbbrev: 'EDM',
          opponent: 'COL',
          gameTimeUTC: '2026-01-15T03:00:00Z',
        }),
        matchup({
          playerId: 2,
          teamAbbrev: 'BOS',
          opponent: 'NYR',
          gameTimeUTC: '2026-01-15T00:00:00Z',
        }),
      ],
      [],
    );

    expect(result[0][1].players[0].playerId).toBe(2); // earlier UTC first
  });
});
