import { describe, expect, it } from 'vitest';

import { compareByLastSeason, lastSeasonValue, sortByLastSeason } from './playerRanking';
import type { RosterPerson, StatsMap } from '../utils/nhlApi';

function player(id: number, first: string, last: string, code: string): RosterPerson {
    return {
        person: { id, firstName: { default: first }, lastName: { default: last } },
        jerseyNumber: '00',
        position: { code, name: code },
    } as RosterPerson;
}

const mcdavid = player(1, 'Connor', 'McDavid', 'C');
const bouchard = player(2, 'Evan', 'Bouchard', 'D');
const hellebuyck = player(3, 'Connor', 'Hellebuyck', 'G');
const rookie = player(4, 'Some', 'Rookie', 'C');
// Same surname order matters for the tiebreak assertions below.
const aaron = player(5, 'Aaron', 'Aardvark', 'C');
const zane = player(6, 'Zane', 'Zulu', 'C');

const stats: StatsMap = {
    1: { playerId: 1, points: 132, goals: 64, assists: 68 },
    2: { playerId: 2, points: 82, goals: 18, assists: 64 },
    3: { playerId: 3, points: 0, goals: 0, assists: 0, wins: 37 },
    5: { playerId: 5, points: 50, goals: 20, assists: 30 },
    6: { playerId: 6, points: 50, goals: 25, assists: 25 },
};

describe('lastSeasonValue', () => {
    it('measures skaters in points', () => {
        expect(lastSeasonValue(mcdavid, stats)).toBe(132);
        expect(lastSeasonValue(bouchard, stats)).toBe(82);
    });

    it('measures goalies in wins, not points', () => {
        expect(lastSeasonValue(hellebuyck, stats)).toBe(37);
    });

    it('sorts a player with no stats last rather than first', () => {
        expect(lastSeasonValue(rookie, stats)).toBe(-1);
        expect(lastSeasonValue(rookie, stats)).toBeLessThan(lastSeasonValue(hellebuyck, stats));
    });
});

describe('sortByLastSeason', () => {
    it('puts the best available player first', () => {
        const sorted = sortByLastSeason([rookie, bouchard, mcdavid, hellebuyck], stats);
        expect(sorted.map((p) => p.person.lastName.default)).toEqual([
            'McDavid',
            'Bouchard',
            'Hellebuyck',
            'Rookie',
        ]);
    });

    it('breaks ties by name so the order is stable across renders', () => {
        expect(sortByLastSeason([zane, aaron], stats).map((p) => p.person.lastName.default))
            .toEqual(['Aardvark', 'Zulu']);
        // Same result from the opposite input order — the comparator is total.
        expect(sortByLastSeason([aaron, zane], stats).map((p) => p.person.lastName.default))
            .toEqual(['Aardvark', 'Zulu']);
    });

    it('does not reorder the array it was given', () => {
        const input = [rookie, mcdavid];
        sortByLastSeason(input, stats);
        expect(input.map((p) => p.person.id)).toEqual([4, 1]);
    });

    it('is a consistent comparator (a<b implies b>a)', () => {
        const cmp = compareByLastSeason(stats);
        expect(Math.sign(cmp(mcdavid, hellebuyck))).toBe(-Math.sign(cmp(hellebuyck, mcdavid)));
        expect(Math.sign(cmp(aaron, zane))).toBe(-Math.sign(cmp(zane, aaron)));
    });

    it('ranks goalies against each other correctly once filtered to goalies', () => {
        const backup = player(7, 'Back', 'Up', 'G');
        const withBackup: StatsMap = { ...stats, 7: { playerId: 7, points: 0, goals: 0, assists: 0, wins: 12 } };
        expect(sortByLastSeason([backup, hellebuyck], withBackup).map((p) => p.person.id)).toEqual([3, 7]);
    });
});
