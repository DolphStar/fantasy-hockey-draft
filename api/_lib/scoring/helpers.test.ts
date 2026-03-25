import { describe, expect, it } from 'vitest';

import {
  buildActivePlayerToTeamMap,
  filterCompletedGamesForScoring,
  isRosterSwapDayOfWeek,
} from './helpers';

describe('isRosterSwapDayOfWeek', () => {
  it('is true only for Saturday (6)', () => {
    expect(isRosterSwapDayOfWeek(6)).toBe(true);
    expect(isRosterSwapDayOfWeek(5)).toBe(false);
    expect(isRosterSwapDayOfWeek(0)).toBe(false);
  });
});

describe('filterCompletedGamesForScoring', () => {
  const games = [
    { id: 1, gameState: 'OFF', gameType: 2 },
    { id: 2, gameState: 'FINAL', gameType: 3 },
    { id: 3, gameState: 'LIVE', gameType: 2 },
    { id: 4, gameState: 'OFF', gameType: 2 },
  ] as const;

  it('keeps OFF/FINAL games whose gameType is allowed', () => {
    const { completedGames, skippedByType } = filterCompletedGamesForScoring(
      [...games],
      [2],
    );
    expect(completedGames.map((g) => g.id)).toEqual([1, 4]);
    expect(skippedByType.map((g) => g.id)).toEqual([2]);
  });
});

describe('buildActivePlayerToTeamMap', () => {
  it('maps active roster only and counts reserves', () => {
    const { playerToTeamMap, reserveCount } = buildActivePlayerToTeamMap([
      { playerId: 10, rosterSlot: 'active', draftedByTeam: 'A' },
      { playerId: 20, rosterSlot: 'reserve', draftedByTeam: 'B' },
      { playerId: 30, rosterSlot: 'active', draftedByTeam: 'C' },
    ]);
    expect(reserveCount).toBe(1);
    expect([...playerToTeamMap.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [10, 'A'],
      [30, 'C'],
    ]);
  });
});
