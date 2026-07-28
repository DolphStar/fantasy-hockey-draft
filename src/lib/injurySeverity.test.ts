import { describe, expect, it } from 'vitest';

import { compareBySeverity, outUntil, severityRank, sortBySeverity } from './injurySeverity';
import type { InjuryReport } from '../services/injuryService';

function injury(partial: Partial<InjuryReport>): InjuryReport {
    return {
        playerId: 1,
        playerName: 'Player',
        team: 'Team',
        teamAbbrev: 'TBD',
        position: 'C',
        status: 'Out',
        injuryType: 'Upper Body',
        description: '',
        ...partial,
    } as InjuryReport;
}

describe('severityRank', () => {
    it('ranks IR as worse than out, and out as worse than day-to-day', () => {
        expect(severityRank('Injured Reserve')).toBeLessThan(severityRank('Out'));
        expect(severityRank('Out')).toBeLessThan(severityRank('Day-To-Day'));
    });

    it('is case- and whitespace-insensitive, because the feed is not consistent', () => {
        expect(severityRank('  injured reserve ')).toBe(severityRank('Injured Reserve'));
        expect(severityRank('OUT')).toBe(severityRank('Out'));
    });

    it('puts suspensions below every injury', () => {
        expect(severityRank('Suspension')).toBeGreaterThan(severityRank('Day-To-Day'));
    });

    it('sorts an unrecognised status after everything known', () => {
        expect(severityRank('Sore vibes')).toBeGreaterThan(severityRank('Suspension'));
        expect(severityRank(undefined)).toBeGreaterThan(severityRank('Suspension'));
    });
});

describe('outUntil', () => {
    it('treats a missing return date as unknown, not as a long absence', () => {
        expect(outUntil({ returnDate: undefined })).toBe(-Infinity);
        expect(outUntil({ returnDate: 'sometime' })).toBe(-Infinity);
    });

    it('reads a real date', () => {
        expect(outUntil({ returnDate: '2026-09-14' })).toBe(Date.parse('2026-09-14'));
    });
});

describe('sortBySeverity', () => {
    it('leads with the most severe status regardless of team', () => {
        const list = [
            injury({ playerName: 'Zed', teamAbbrev: 'ANA', status: 'Day-To-Day' }),
            injury({ playerName: 'Abe', teamAbbrev: 'WPG', status: 'Injured Reserve' }),
            injury({ playerName: 'Moe', teamAbbrev: 'BOS', status: 'Out' }),
        ];
        expect(sortBySeverity(list).map((i) => i.playerName)).toEqual(['Abe', 'Moe', 'Zed']);
    });

    it('puts the player out longest first within a status', () => {
        const list = [
            injury({ playerName: 'Back soon', status: 'Out', returnDate: '2026-08-01' }),
            injury({ playerName: 'Back late', status: 'Out', returnDate: '2026-12-01' }),
        ];
        expect(sortBySeverity(list).map((i) => i.playerName)).toEqual(['Back late', 'Back soon']);
    });

    it('sorts an unknown return date after a known one at the same status', () => {
        const list = [
            injury({ playerName: 'Unknown', status: 'Out' }),
            injury({ playerName: 'Known', status: 'Out', returnDate: '2026-12-01' }),
        ];
        expect(sortBySeverity(list).map((i) => i.playerName)).toEqual(['Known', 'Unknown']);
    });

    it('breaks remaining ties by name so the order is stable', () => {
        const a = injury({ playerName: 'Aardvark', status: 'Out' });
        const z = injury({ playerName: 'Zulu', status: 'Out' });
        expect(sortBySeverity([z, a]).map((i) => i.playerName)).toEqual(['Aardvark', 'Zulu']);
        expect(sortBySeverity([a, z]).map((i) => i.playerName)).toEqual(['Aardvark', 'Zulu']);
    });

    it('is a consistent comparator', () => {
        const a = injury({ playerName: 'A', status: 'Out', returnDate: '2026-12-01' });
        const b = injury({ playerName: 'B', status: 'Day-To-Day' });
        expect(Math.sign(compareBySeverity(a, b))).toBe(-Math.sign(compareBySeverity(b, a)));
    });

    it('does not reorder the array it was given', () => {
        const input = [injury({ playerName: 'Zed', status: 'Day-To-Day' }), injury({ playerName: 'Abe', status: 'Out' })];
        sortBySeverity(input);
        expect(input.map((i) => i.playerName)).toEqual(['Zed', 'Abe']);
    });
});
