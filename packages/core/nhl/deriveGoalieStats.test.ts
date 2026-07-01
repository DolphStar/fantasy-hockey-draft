import { describe, expect, it } from 'vitest';

import { deriveGoalieShutout, deriveGoalieWin } from './deriveGoalieStats.js';

describe('deriveGoalieWin', () => {
  it('credits a win only for decision W', () => {
    expect(deriveGoalieWin('W')).toBe(1);
    expect(deriveGoalieWin('L')).toBe(0);
    expect(deriveGoalieWin('O')).toBe(0);
    expect(deriveGoalieWin(undefined)).toBe(0);
  });
});

describe('deriveGoalieShutout', () => {
  it('credits a shutout for a decision goalie with 0 GA and at least one save', () => {
    expect(deriveGoalieShutout({ decision: 'W', goalsAgainst: 0, saves: 22 })).toBe(1);
  });

  it('credits a shutout for an OT/SO loss with 0 goals against (NHL rule)', () => {
    expect(deriveGoalieShutout({ decision: 'O', goalsAgainst: 0, saves: 30 })).toBe(1);
  });

  it('does not credit a shutout when goals were allowed', () => {
    expect(deriveGoalieShutout({ decision: 'L', goalsAgainst: 5, saves: 17 })).toBe(0);
  });

  it('does not credit a shutout without a decision (relief appearance)', () => {
    expect(deriveGoalieShutout({ decision: undefined, goalsAgainst: 0, saves: 4 })).toBe(0);
  });

  it('does not credit a shutout with zero saves (never faced a shot / DNP)', () => {
    expect(deriveGoalieShutout({ decision: 'W', goalsAgainst: 0, saves: 0 })).toBe(0);
    expect(deriveGoalieShutout({ decision: 'W', goalsAgainst: 0 })).toBe(0);
  });
});
