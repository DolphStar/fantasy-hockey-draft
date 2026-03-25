import { describe, expect, it } from 'vitest';

import type { PlayerGameStats } from '../nhl/types';

import { DEFAULT_SCORING_RULES } from './defaults';
import { calculatePlayerPoints } from './scoringMath';

describe('calculatePlayerPoints', () => {
  it('applies defense bonuses on top of skater scoring', () => {
    expect(
      calculatePlayerPoints(
        {
          playerId: 8,
          name: { default: 'Cale Makar' },
          position: 'D',
          goals: 1,
          assists: 2,
          shortHandedGoals: 1,
          blockedShots: 4,
          hits: 5,
          fights: 1,
        },
        DEFAULT_SCORING_RULES,
      ),
    ).toBeCloseTo(7.1, 5);
  });

  it('does not apply defense bonuses for non-defense skaters', () => {
    expect(
      calculatePlayerPoints(
        {
          playerId: 97,
          name: { default: 'Connor McDavid' },
          position: 'C',
          goals: 1,
          assists: 2,
          shortHandedGoals: 1,
          blockedShots: 4,
          hits: 5,
          fights: 1,
        },
        DEFAULT_SCORING_RULES,
      ),
    ).toBeCloseTo(6, 5);
  });

  it('does not apply defense bonuses for non-canonical defense strings', () => {
    expect(
      calculatePlayerPoints(
        {
          playerId: 25,
          name: { default: 'Mikhail Sergachev' },
          position: ' rd ',
          goals: 1,
          assists: 2,
          shortHandedGoals: 1,
          blockedShots: 4,
          hits: 5,
          fights: 1,
        },
        DEFAULT_SCORING_RULES,
      ),
    ).toBeCloseTo(6, 5);
  });

  it('applies the goalie-specific scoring categories', () => {
    expect(
      calculatePlayerPoints(
        {
          playerId: 31,
          name: { default: 'Igor Shesterkin' },
          position: 'G',
          wins: 1,
          shutouts: 1,
          saves: 25,
          assists: 1,
          fights: 1,
        },
        DEFAULT_SCORING_RULES,
      ),
    ).toBeCloseTo(10, 5);
  });

  it('does not apply goalie scoring for non-canonical goalie strings', () => {
    expect(
      calculatePlayerPoints(
        {
          playerId: 88,
          name: { default: 'Juuse Saros' },
          position: ' g ',
          wins: 1,
          shutouts: 1,
          saves: 25,
          assists: 1,
          fights: 1,
        },
        DEFAULT_SCORING_RULES,
      ),
    ).toBeCloseTo(3, 5);
  });

  it('does not apply defense bonuses for unknown positions', () => {
    expect(
      calculatePlayerPoints(
        {
          playerId: 19,
          name: { default: 'Test Player' },
          position: 'X',
          goals: 1,
          assists: 2,
          shortHandedGoals: 1,
          blockedShots: 4,
          hits: 5,
          fights: 1,
        },
        DEFAULT_SCORING_RULES,
      ),
    ).toBeCloseTo(6, 5);
  });

  it('does not throw when position is missing at runtime', () => {
    expect(
      calculatePlayerPoints(
        {
          playerId: 20,
          name: { default: 'Missing Position' },
          goals: 1,
          assists: 2,
          shortHandedGoals: 1,
          blockedShots: 4,
          hits: 5,
          fights: 1,
        } as PlayerGameStats,
        DEFAULT_SCORING_RULES,
      ),
    ).toBeCloseTo(6, 5);
  });

  it('does not throw when position is not a string at runtime', () => {
    expect(
      calculatePlayerPoints(
        {
          playerId: 21,
          name: { default: 'Invalid Position' },
          position: 123,
          goals: 1,
          assists: 2,
          shortHandedGoals: 1,
          blockedShots: 4,
          hits: 5,
          fights: 1,
        } as unknown as PlayerGameStats,
        DEFAULT_SCORING_RULES,
      ),
    ).toBeCloseTo(6, 5);
  });
});
