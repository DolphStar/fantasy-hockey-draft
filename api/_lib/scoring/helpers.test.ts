import { describe, expect, it } from 'vitest';

import {
  buildActivePlayerToTeamMap,
  isCompletedGame,
  isRosterSwapDayOfWeek,
} from './helpers';

describe('isRosterSwapDayOfWeek', () => {
  it('is true only for Saturday (6)', () => {
    expect(isRosterSwapDayOfWeek(6)).toBe(true);
    expect(isRosterSwapDayOfWeek(5)).toBe(false);
    expect(isRosterSwapDayOfWeek(0)).toBe(false);
  });
});

describe('isCompletedGame', () => {
  it('is true only for OFF or FINAL game states', () => {
    expect(isCompletedGame({ gameState: 'OFF' })).toBe(true);
    expect(isCompletedGame({ gameState: 'FINAL' })).toBe(true);
    expect(isCompletedGame({ gameState: 'LIVE' })).toBe(false);
    expect(isCompletedGame({ gameState: 'FUT' })).toBe(false);
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
