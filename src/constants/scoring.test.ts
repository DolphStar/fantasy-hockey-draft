import { describe, expect, it } from 'vitest';

import { DEFAULT_ROSTER_SETTINGS, DEFAULT_SCORING_RULES } from './scoring';

describe('scoring defaults', () => {
  it('keeps the full scoring rules shape in one place', () => {
    expect(DEFAULT_SCORING_RULES).toEqual({
      goal: 1,
      assist: 1,
      shortHandedGoal: 1,
      overtimeGoal: 1,
      fight: 2,
      blockedShot: 0.15,
      hit: 0.1,
      win: 1,
      shutout: 2,
      save: 0.04,
      goalieAssist: 1,
      goalieGoal: 20,
      goalieFight: 5,
    });
  });

  it('keeps the default roster shape in one place', () => {
    expect(DEFAULT_ROSTER_SETTINGS).toEqual({
      forwards: 9,
      defensemen: 6,
      goalies: 2,
      reserves: 5,
    });
  });
});
