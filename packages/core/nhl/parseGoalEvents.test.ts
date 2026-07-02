import { describe, expect, it } from 'vitest';

import { parseGoalEvents } from './parseGoalEvents.js';

const landing = (scoring: unknown) => ({ summary: { scoring } });

describe('parseGoalEvents', () => {
  it('counts goals and assists per player', () => {
    const result = parseGoalEvents(
      landing([
        {
          periodDescriptor: { number: 1, periodType: 'REG' },
          goals: [
            { playerId: 10, strength: 'ev', assists: [{ playerId: 20 }, { playerId: 30 }] },
            { playerId: 10, strength: 'pp', assists: [] },
          ],
        },
      ]),
    );
    expect(result.get(10)).toEqual({ goals: 2, assists: 0, shortHandedGoals: 0, overtimeGoals: 0 });
    expect(result.get(20)).toEqual({ goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0 });
    expect(result.get(30)).toEqual({ goals: 0, assists: 1, shortHandedGoals: 0, overtimeGoals: 0 });
  });

  it('counts short-handed goals via strength sh', () => {
    const result = parseGoalEvents(
      landing([
        {
          periodDescriptor: { number: 2, periodType: 'REG' },
          goals: [{ playerId: 10, strength: 'sh', assists: [] }],
        },
      ]),
    );
    expect(result.get(10)).toEqual({ goals: 1, assists: 0, shortHandedGoals: 1, overtimeGoals: 0 });
  });

  it('counts overtime goals via periodType OT', () => {
    const result = parseGoalEvents(
      landing([
        {
          periodDescriptor: { number: 4, periodType: 'OT' },
          goals: [{ playerId: 10, strength: 'ev', assists: [{ playerId: 20 }] }],
        },
      ]),
    );
    expect(result.get(10)).toEqual({ goals: 1, assists: 0, shortHandedGoals: 0, overtimeGoals: 1 });
  });

  it('ignores shootout periods', () => {
    const result = parseGoalEvents(
      landing([
        {
          periodDescriptor: { number: 5, periodType: 'SO' },
          goals: [{ playerId: 10, strength: 'ev', assists: [] }],
        },
      ]),
    );
    expect(result.size).toBe(0);
  });

  it('returns an empty map for malformed input', () => {
    expect(parseGoalEvents(null).size).toBe(0);
    expect(parseGoalEvents({}).size).toBe(0);
    expect(parseGoalEvents({ summary: {} }).size).toBe(0);
    expect(parseGoalEvents(landing([{ periodDescriptor: { periodType: 'REG' } }])).size).toBe(0);
  });
});
