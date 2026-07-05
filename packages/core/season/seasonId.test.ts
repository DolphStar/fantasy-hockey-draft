import { describe, expect, it } from 'vitest';

import { nextSeasonId, nhlSeasonIdForDate } from './seasonId';

describe('nhlSeasonIdForDate', () => {
  it('maps mid-season dates (Oct–Dec) to the season starting that year', () => {
    expect(nhlSeasonIdForDate(new Date('2025-11-15T12:00:00Z'))).toBe('2025-26');
  });

  it('maps Jan–Sep dates to the season that started the previous year', () => {
    expect(nhlSeasonIdForDate(new Date('2026-03-01T12:00:00Z'))).toBe('2025-26');
    expect(nhlSeasonIdForDate(new Date('2026-07-05T12:00:00Z'))).toBe('2025-26');
  });

  it('rolls over on Oct 1', () => {
    expect(nhlSeasonIdForDate(new Date('2026-09-30T12:00:00Z'))).toBe('2025-26');
    expect(nhlSeasonIdForDate(new Date('2026-10-01T12:00:00Z'))).toBe('2026-27');
  });
});

describe('nextSeasonId', () => {
  it('advances one season', () => {
    expect(nextSeasonId('2025-26')).toBe('2026-27');
    expect(nextSeasonId('2099-00')).toBe('2100-01');
  });
});
