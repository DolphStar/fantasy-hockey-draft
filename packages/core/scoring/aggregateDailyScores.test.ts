import { describe, expect, it } from 'vitest';

import type { PlayerGameStats } from '../nhl/types';

import { aggregateDailyScores } from './aggregateDailyScores';
import { DEFAULT_SCORING_RULES } from './defaults';

const DATE = '2026-06-09';

function skater(overrides: Partial<PlayerGameStats> & { playerId: number }): PlayerGameStats {
  return { name: { default: `Player ${overrides.playerId}` }, position: 'C', ...overrides };
}

describe('aggregateDailyScores (golden master)', () => {
  const playerToTeamMap = new Map<number, string>([
    [1, 'Team A'], // center
    [2, 'Team A'], // defenseman
    [3, 'Team B'], // goalie
    [4, 'Team B'], // played, zero stats
  ]);

  const game1: PlayerGameStats[] = [
    skater({ playerId: 1, teamAbbrev: 'EDM', goals: 2, assists: 1, hits: 3, blockedShots: 2 }),
    skater({ playerId: 2, position: 'D', teamAbbrev: 'COL', goals: 1, assists: 1, blockedShots: 4, hits: 5 }),
    skater({ playerId: 99, goals: 5 }), // undrafted — ignored
  ];

  const game2: PlayerGameStats[] = [
    skater({ playerId: 3, position: 'G', teamAbbrev: 'NYR', wins: 1, saves: 30, shutouts: 1 }),
    skater({ playerId: 4, teamAbbrev: 'BOS', goals: 0, assists: 0 }),
  ];

  it('produces exact team totals across games', () => {
    const { teamPoints } = aggregateDailyScores([game1, game2], playerToTeamMap, DEFAULT_SCORING_RULES, DATE);

    // Team A: center 2g+1a = 3; dman 1g+1a+4*0.15+5*0.1 = 3.1
    expect(teamPoints.get('Team A')).toBeCloseTo(6.1, 5);
    // Team B: goalie 1 win + 30*0.04 + 2 shutout = 4.2; zero-stat skater adds 0
    expect(teamPoints.get('Team B')).toBeCloseTo(4.2, 5);
    expect(teamPoints.size).toBe(2);
  });

  it('emits playerScores only for drafted players with positive points', () => {
    const { playerScores } = aggregateDailyScores([game1, game2], playerToTeamMap, DEFAULT_SCORING_RULES, DATE);

    expect(playerScores.map((p) => p.playerId)).toEqual([1, 2, 3]);
    expect(playerScores[0]).toEqual({
      playerId: 1,
      playerName: 'Player 1',
      teamName: 'Team A',
      nhlTeam: 'EDM',
      date: DATE,
      points: 3,
      stats: { goals: 2, assists: 1, hits: 3, blockedShots: 2 },
    });
  });

  it('defaults nhlTeam to UNK and omits undefined stats', () => {
    const { playerScores } = aggregateDailyScores(
      [[skater({ playerId: 1, goals: 1 })]],
      playerToTeamMap,
      DEFAULT_SCORING_RULES,
      DATE,
    );

    expect(playerScores[0].nhlTeam).toBe('UNK');
    expect(playerScores[0].stats).toEqual({ goals: 1 });
  });

  it('skips players whose computed points are non-finite (historical behavior)', () => {
    const badRules = { ...DEFAULT_SCORING_RULES, goal: Number.NaN };
    const { teamPoints, playerScores } = aggregateDailyScores(
      [[skater({ playerId: 1, goals: 1 }), skater({ playerId: 2, position: 'D', assists: 2 })]],
      playerToTeamMap,
      badRules,
      DATE,
    );

    // 0 * NaN = NaN poisons every skater computed with these rules, so the
    // pipeline drops both players rather than partially scoring them.
    expect(teamPoints.size).toBe(0);
    expect(playerScores).toEqual([]);
  });

  it('returns empty aggregation for no games', () => {
    const { teamPoints, playerScores } = aggregateDailyScores([], playerToTeamMap, DEFAULT_SCORING_RULES, DATE);
    expect(teamPoints.size).toBe(0);
    expect(playerScores).toEqual([]);
  });
});
