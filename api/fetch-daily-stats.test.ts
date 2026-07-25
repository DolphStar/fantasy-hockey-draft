import { describe, expect, it } from 'vitest';

import boxscoreFixture from './_lib/nhl/fixtures/boxscore-2025020947.json';
import handler, { scoreGoalieEntry, selectCompletedGameIds } from './fetch-daily-stats';

describe('fetch-daily-stats route', () => {
  it('default export is a function', () => {
    expect(typeof handler).toBe('function');
  });
});

const game = (id: number, gameType: number, gameState = 'OFF') => ({ id, gameType, gameState });

describe('selectCompletedGameIds', () => {
  it('keeps completed regular-season and playoff games', () => {
    const games = [game(1, 2, 'OFF'), game(2, 3, 'FINAL'), game(3, 2, 'FINAL')];
    expect(selectCompletedGameIds(games)).toEqual([1, 2, 3]);
  });

  it('excludes preseason and all-star games even when completed', () => {
    const games = [game(1, 1), game(2, 2), game(3, 4)];
    expect(selectCompletedGameIds(games)).toEqual([2]);
  });

  it('excludes games that are not final', () => {
    const games = [game(1, 2, 'LIVE'), game(2, 2, 'FUT'), game(3, 2, 'CRIT')];
    expect(selectCompletedGameIds(games)).toEqual([]);
  });

  it('excludes games with a missing gameType', () => {
    const games = [{ id: 1, gameState: 'OFF' }, game(2, 2)];
    expect(selectCompletedGameIds(games)).toEqual([2]);
  });
});

describe('scoreGoalieEntry', () => {
  /**
   * The regression this function exists for. `saveShotsAgainst` is a string
   * ("17/22"); the old code multiplied it by the save rate, so `points` became
   * NaN for every goalie. NaN survives `?? 0` in the waiver-wire reader, so
   * goalies silently disappeared from Hot Pickups.
   */
  it('ignores the string saveShotsAgainst field instead of poisoning the total', () => {
    const { points } = scoreGoalieEntry({
      decision: 'W',
      saves: 17,
      goalsAgainst: 5,
      saveShotsAgainst: '17/22',
    } as Parameters<typeof scoreGoalieEntry>[0]);

    expect(Number.isNaN(points)).toBe(false);
    expect(points).toBeCloseTo(1 + 17 * 0.04, 10); // 1.68
  });

  it('counts saves once, not twice', () => {
    // The old code added saves at the save rate twice; the NaN above hid it.
    expect(scoreGoalieEntry({ decision: 'L', saves: 25, goalsAgainst: 3 }).points)
      .toBeCloseTo(25 * 0.04, 10);
  });

  it('derives a shutout from decision + zero goals against', () => {
    const shutout = scoreGoalieEntry({ decision: 'W', saves: 22, goalsAgainst: 0 });
    expect(shutout).toMatchObject({ wins: 1, shutouts: 1, saves: 22 });
    expect(shutout.points).toBeCloseTo(1 + 2 + 22 * 0.04, 10); // 3.88
  });

  it('gives no shutout to a goalie who never faced a shot', () => {
    expect(scoreGoalieEntry({ decision: 'W', saves: 0, goalsAgainst: 0 }))
      .toMatchObject({ shutouts: 0, points: 1 });
  });

  it('gives no win or shutout without a decision', () => {
    expect(scoreGoalieEntry({ saves: 10, goalsAgainst: 0 }))
      .toMatchObject({ wins: 0, shutouts: 0 });
  });

  it('survives missing or non-numeric fields', () => {
    expect(scoreGoalieEntry({})).toMatchObject({ points: 0, saves: 0 });
    expect(scoreGoalieEntry({ saves: 'nonsense', goalsAgainst: undefined }))
      .toMatchObject({ points: 0, saves: 0 });
  });

  it('scores both goalies from a real captured boxscore', () => {
    const goalies = [
      ...boxscoreFixture.playerByGameStats.homeTeam.goalies,
      ...boxscoreFixture.playerByGameStats.awayTeam.goalies,
    ] as Parameters<typeof scoreGoalieEntry>[0][];

    // Guards the premise: the real API really does send this as a string.
    expect(
      goalies.every((g) => typeof (g as { saveShotsAgainst?: unknown }).saveShotsAgainst === 'string'),
    ).toBe(true);

    for (const goalie of goalies) {
      expect(Number.isFinite(scoreGoalieEntry(goalie).points)).toBe(true);
    }

    // Four dressed goalies: two played, two unused backups ("0/0") score nothing.
    // Silovs: W, 22 saves, 0 GA -> win + shutout + saves = 3.88
    // Hill:   L, 17 saves, 5 GA -> saves only            = 0.68
    expect(goalies.map((g) => Number(scoreGoalieEntry(g).points.toFixed(2))).sort((a, b) => a - b))
      .toEqual([0, 0, 0.68, 3.88]);
  });
});
