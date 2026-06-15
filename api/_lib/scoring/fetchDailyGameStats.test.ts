import { describe, expect, it } from 'vitest';

import {
  countFightsFromPlayByPlay,
  filterGameStatsByType,
  type DailyGameStats,
} from './fetchDailyGameStats';

const game = (gameId: number, gameType: number): DailyGameStats => ({
  gameId,
  gameType,
  players: [],
});

describe('filterGameStatsByType', () => {
  it('keeps only games whose gameType is allowed and counts the rest', () => {
    const games = [game(1, 2), game(2, 3), game(3, 2)];
    const { included, skippedTypeCount } = filterGameStatsByType(games, [2]);
    expect(included.map((g) => g.gameId)).toEqual([1, 3]);
    expect(skippedTypeCount).toBe(1);
  });

  it('returns everything when all types are allowed', () => {
    const games = [game(1, 2), game(2, 3)];
    const { included, skippedTypeCount } = filterGameStatsByType(games, [2, 3]);
    expect(included).toHaveLength(2);
    expect(skippedTypeCount).toBe(0);
  });
});

describe('countFightsFromPlayByPlay', () => {
  it('counts fighting penalties per committing player', () => {
    const pbp = {
      plays: [
        { typeDescKey: 'penalty', details: { descKey: 'fighting', committedByPlayerId: 10 } },
        { typeDescKey: 'penalty', details: { descKey: 'fighting', committedByPlayerId: 10 } },
        { typeDescKey: 'penalty', details: { descKey: 'hooking', committedByPlayerId: 20 } },
        { typeDescKey: 'goal', details: {} },
      ],
    };
    const counts = countFightsFromPlayByPlay(pbp);
    expect(counts.get(10)).toBe(2);
    expect(counts.has(20)).toBe(false);
  });

  it('returns an empty map for malformed input', () => {
    expect(countFightsFromPlayByPlay(null).size).toBe(0);
    expect(countFightsFromPlayByPlay({}).size).toBe(0);
  });
});
