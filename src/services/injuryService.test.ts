import { describe, expect, it } from 'vitest';
import { parseInjuriesResponse } from './injuryService';

/**
 * Mirrors the real ESPN payload, including the two things that matter here: the
 * athlete object carries NO `id` field, and the athlete id is only recoverable
 * from the headshot URL. Verified against the live endpoint on 2026-07-25
 * (78 injuries, 0 with `athlete.id`, 77 with a headshot).
 */
const ESPN_PAYLOAD = {
    injuries: [
        {
            id: '25',
            displayName: 'Anaheim Ducks',
            injuries: [
                {
                    status: 'Out',
                    longComment: 'Jensen is week-to-week with a knee injury.',
                    shortComment: 'Jensen is out.',
                    athlete: {
                        firstName: 'Nick',
                        lastName: 'Jensen',
                        displayName: 'Nick Jensen',
                        headshot: {
                            href: 'https://a.espncdn.com/i/headshots/nhl/players/full/3025608.png',
                            alt: 'Nick Jensen',
                        },
                        position: { abbreviation: 'D' },
                        team: { abbreviation: 'ANA' },
                    },
                    details: { type: 'Knee', returnDate: '2026-09-14' },
                },
                {
                    // Call-ups sometimes have no photo on file.
                    status: 'Day-To-Day',
                    athlete: {
                        displayName: 'Charlie Stramel',
                        position: { abbreviation: 'C' },
                        team: { abbreviation: 'ANA' },
                    },
                    details: { type: 'Upper Body' },
                },
            ],
        },
    ],
};

describe('parseInjuriesResponse', () => {
    it('reads the ESPN headshot onto every athlete that has one', () => {
        const [jensen] = parseInjuriesResponse(ESPN_PAYLOAD);
        expect(jensen.headshotUrl).toBe(
            'https://a.espncdn.com/i/headshots/nhl/players/full/3025608.png',
        );
    });

    it('recovers the athlete id from the headshot URL', () => {
        const [jensen] = parseInjuriesResponse(ESPN_PAYLOAD);
        // The feed sends no athlete.id at all, so parsing it out of the headshot
        // is the only way this is ever non-zero.
        expect(jensen.playerId).toBe(3025608);
    });

    it('still returns a usable report when the athlete has no headshot', () => {
        const [, stramel] = parseInjuriesResponse(ESPN_PAYLOAD);
        expect(stramel.headshotUrl).toBeUndefined();
        expect(stramel.playerId).toBe(0);
        expect(stramel.playerName).toBe('Charlie Stramel');
        expect(stramel.injuryType).toBe('Upper Body');
    });

    it('gives distinct ids to distinct players so list keys stay unique', () => {
        const reports = parseInjuriesResponse(ESPN_PAYLOAD);
        const keys = reports.map((r) => r.playerId || r.playerName);
        expect(new Set(keys).size).toBe(reports.length);
    });

    it('prefers athlete.id if ESPN ever sends the field again', () => {
        const withId = {
            injuries: [
                {
                    id: '25',
                    displayName: 'Anaheim Ducks',
                    injuries: [
                        {
                            status: 'Out',
                            athlete: {
                                id: '999',
                                displayName: 'Test Player',
                                headshot: {
                                    href: 'https://a.espncdn.com/i/headshots/nhl/players/full/111.png',
                                },
                            },
                            details: {},
                        },
                    ],
                },
            ],
        };
        expect(parseInjuriesResponse(withId)[0].playerId).toBe(999);
    });

    it('carries the rest of the report through unchanged', () => {
        const [jensen] = parseInjuriesResponse(ESPN_PAYLOAD);
        expect(jensen).toMatchObject({
            playerName: 'Nick Jensen',
            team: 'Anaheim Ducks',
            teamAbbrev: 'ANA',
            position: 'D',
            status: 'Out',
            injuryType: 'Knee',
            description: 'Jensen is week-to-week with a knee injury.',
            returnDate: '2026-09-14',
        });
    });

    it('returns an empty list rather than throwing on a malformed payload', () => {
        expect(parseInjuriesResponse(null)).toEqual([]);
        expect(parseInjuriesResponse({})).toEqual([]);
        expect(parseInjuriesResponse({ injuries: 'nope' })).toEqual([]);
    });
});
