import { describe, expect, it } from 'vitest';

import {
  type LiveStatSnapshot,
  resolveDisplayedScores,
  resolveLiveGameDisplayScores,
  shouldSkipPreviousDayFinalWithoutStoredSample,
} from './helpers';

describe('resolveDisplayedScores', () => {
  it('preserves existing non-zero score when API reports 0-0', () => {
    expect(
      resolveDisplayedScores(0, 0, { awayScore: 2, homeScore: 1, goals: 1, assists: 0 }),
    ).toEqual({ awayScore: 2, homeScore: 1 });
  });

  it('does not preserve when API reports non-zero scores', () => {
    expect(resolveDisplayedScores(1, 0, { awayScore: 2, homeScore: 1 })).toEqual({
      awayScore: 1,
      homeScore: 0,
    });
  });

  it('returns API scores when there is no existing doc', () => {
    expect(resolveDisplayedScores(0, 0, null)).toEqual({ awayScore: 0, homeScore: 0 });
    expect(resolveDisplayedScores(0, 0, undefined)).toEqual({ awayScore: 0, homeScore: 0 });
  });
});

describe('shouldSkipPreviousDayFinalWithoutStoredSample', () => {
  it('skips previous-day finals when no stored live doc exists', () => {
    expect(
      shouldSkipPreviousDayFinalWithoutStoredSample({
        isPreviousDayGame: true,
        hasExistingLiveDoc: false,
      }),
    ).toBe(true);
  });

  it('does not skip when not previous-day', () => {
    expect(
      shouldSkipPreviousDayFinalWithoutStoredSample({
        isPreviousDayGame: false,
        hasExistingLiveDoc: false,
      }),
    ).toBe(false);
  });

  it('does not skip previous-day when a doc exists', () => {
    expect(
      shouldSkipPreviousDayFinalWithoutStoredSample({
        isPreviousDayGame: true,
        hasExistingLiveDoc: true,
      }),
    ).toBe(false);
  });
});

describe('resolveLiveGameDisplayScores', () => {
  function snapshot(overrides: Partial<LiveStatSnapshot>): LiveStatSnapshot {
    return {
      awayScore: 1,
      homeScore: 1,
      goals: 1,
      assists: 0,
      ...overrides,
    };
  }

  it('skips FINAL processing when API scores match stored, player has points, and API score is positive', () => {
    const r = resolveLiveGameDisplayScores('FINAL', 2, 1, snapshot({ awayScore: 2, homeScore: 1, goals: 1, assists: 1 }));
    expect(r.skipRestOfGame).toBe(true);
    expect(r.awayScore).toBe(2);
    expect(r.homeScore).toBe(1);
  });

  it('does not skip FINAL when stored points are zero (re-fetch path)', () => {
    const r = resolveLiveGameDisplayScores(
      'FINAL',
      2,
      1,
      snapshot({ awayScore: 2, homeScore: 1, goals: 0, assists: 0 }),
    );
    expect(r.skipRestOfGame).toBe(false);
  });

  it('uses raw API scores when FINAL and API disagrees with stored (even after 0-0 merge)', () => {
    const r = resolveLiveGameDisplayScores(
      'FINAL',
      0,
      0,
      snapshot({ awayScore: 3, homeScore: 2, goals: 1, assists: 0 }),
    );
    expect(r.awayScore).toBe(0);
    expect(r.homeScore).toBe(0);
    expect(r.skipRestOfGame).toBe(false);
  });

  it('treats OFF like FINAL', () => {
    const r = resolveLiveGameDisplayScores('OFF', 1, 0, null);
    expect(r.skipRestOfGame).toBe(false);
    expect(r.awayScore).toBe(1);
    expect(r.homeScore).toBe(0);
  });
});
