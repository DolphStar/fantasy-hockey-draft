import { describe, it, expect } from 'vitest';
import { nextComparisonSelection, isComparisonReady } from './comparison';

const mcdavid = { id: 1 };
const makar = { id: 2 };
const draisaitl = { id: 3 };

describe('nextComparisonSelection', () => {
    it('picks the first player', () => {
        expect(nextComparisonSelection([], mcdavid)).toEqual([mcdavid]);
    });

    it('adds a second player alongside the first', () => {
        expect(nextComparisonSelection([mcdavid], makar)).toEqual([mcdavid, makar]);
    });

    it('un-picks a player that is already selected', () => {
        expect(nextComparisonSelection([mcdavid, makar], makar)).toEqual([mcdavid]);
        expect(nextComparisonSelection([mcdavid], mcdavid)).toEqual([]);
    });

    it('keeps the anchor and replaces the challenger on a third pick', () => {
        expect(nextComparisonSelection([mcdavid, makar], draisaitl)).toEqual([mcdavid, draisaitl]);
    });

    it('never holds more than two players', () => {
        const selection = [mcdavid, makar, draisaitl, { id: 4 }, { id: 5 }].reduce<{ id: number }[]>(
            (acc, player) => nextComparisonSelection(acc, player),
            [],
        );
        expect(selection).toHaveLength(2);
    });

    it('does not mutate the previous selection', () => {
        const current = [mcdavid];
        const next = nextComparisonSelection(current, makar);
        expect(current).toEqual([mcdavid]);
        expect(next).not.toBe(current);
    });
});

describe('isComparisonReady', () => {
    it('is only ready with exactly two players', () => {
        expect(isComparisonReady([])).toBe(false);
        expect(isComparisonReady([mcdavid])).toBe(false);
        expect(isComparisonReady([mcdavid, makar])).toBe(true);
    });
});
