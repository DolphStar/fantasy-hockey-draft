import { describe, expect, it } from 'vitest';

import handler, { selectCompletedGameIds } from './fetch-daily-stats';

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
