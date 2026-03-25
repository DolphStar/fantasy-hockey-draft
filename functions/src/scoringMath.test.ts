import { describe, expect, it } from 'vitest';

import { calculatePlayerPoints } from './scoringMath';

const DEFAULT_SCORING_RULES = {
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
};

describe('functions calculatePlayerPoints', () => {
    it('applies defense bonuses on top of skater scoring', () => {
        expect(
            calculatePlayerPoints(
                {
                    playerId: 8,
                    name: {default: 'Cale Makar'},
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

    it('applies the goalie-specific scoring categories', () => {
        expect(
            calculatePlayerPoints(
                {
                    playerId: 31,
                    name: {default: 'Igor Shesterkin'},
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
});
