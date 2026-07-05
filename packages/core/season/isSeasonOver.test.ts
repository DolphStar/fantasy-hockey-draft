import { describe, expect, it } from 'vitest';

import { isSeasonOver } from './isSeasonOver';

describe('isSeasonOver', () => {
  it('is over 14+ days after the last game, in the May–Sep window', () => {
    expect(isSeasonOver(new Date('2026-07-05T12:00:00Z'), '2026-06-20')).toBe(true);
  });

  it('is not over when the last game was fewer than 14 days ago', () => {
    expect(isSeasonOver(new Date('2026-07-01T12:00:00Z'), '2026-06-20')).toBe(false);
  });

  it('never triggers outside May–September (Olympic-break safety)', () => {
    expect(isSeasonOver(new Date('2026-03-01T12:00:00Z'), '2026-02-01')).toBe(false);
    expect(isSeasonOver(new Date('2026-10-15T12:00:00Z'), '2026-09-01')).toBe(false);
  });

  it('never triggers for a league with no scoring activity', () => {
    expect(isSeasonOver(new Date('2026-07-05T12:00:00Z'), null)).toBe(false);
  });
});
