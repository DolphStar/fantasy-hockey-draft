import { describe, it, expect, vi, afterEach } from 'vitest';
import { getLastSeasonStats } from './nhlApi';

/**
 * Field shapes below are trimmed copies of real
 * api.nhle.com/stats/rest/en/{skater,goalie}/summary records. The UI reads
 * these through StatsMap, so a field dropped here renders as a permanent
 * dash — which is exactly how GAA/shutouts went missing.
 */
const skater = {
    playerId: 8476374,
    skaterFullName: 'Sean Kuraly',
    goals: 9,
    assists: 9,
    points: 18,
    gamesPlayed: 62,
    pointsPerGame: 0.29032,
    plusMinus: -5,
};

const goalie = {
    playerId: 8483575,
    goalieFullName: 'Matt Murray',
    wins: 1,
    losses: 0,
    savePct: 0.912,
    goalsAgainstAverage: 2.68,
    shutouts: 1,
    gamesPlayed: 40,
};

const mockFetch = (payload: unknown, ok = true) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok,
        status: ok ? 200 : 500,
        json: async () => payload,
    }));

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('getLastSeasonStats', () => {
    it('keeps every skater field the cards and comparison read', async () => {
        mockFetch({ skaters: [skater], goalies: [] });

        const stats = await getLastSeasonStats();

        expect(stats[8476374]).toEqual({
            playerId: 8476374,
            goals: 9,
            assists: 9,
            points: 18,
            gamesPlayed: 62,
            pointsPerGame: 0.29032,
        });
    });

    it('keeps GAA and shutouts for goalies', async () => {
        mockFetch({ skaters: [], goalies: [goalie] });

        const stats = await getLastSeasonStats();

        expect(stats[8483575]).toMatchObject({
            wins: 1,
            savePct: 0.912,
            goalsAgainstAverage: 2.68,
            shutouts: 1,
            gamesPlayed: 40,
        });
    });

    it('zeroes skater counting stats for goalies', async () => {
        mockFetch({ skaters: [], goalies: [goalie] });

        const stats = await getLastSeasonStats();

        expect(stats[8483575]).toMatchObject({ points: 0, goals: 0, assists: 0 });
    });

    it('returns an empty map when the request fails', async () => {
        mockFetch({ error: 'nope' }, false);

        await expect(getLastSeasonStats()).resolves.toEqual({});
    });
});
