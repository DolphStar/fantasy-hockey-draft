import { describe, expect, it } from 'vitest';

import {
  getHockeyDay,
  getNewYorkDateString,
  getPreviousNewYorkDateString,
} from './dateUtils';

describe('dateUtils', () => {
  it('formats the current New York calendar day without a hardcoded offset', () => {
    expect(getNewYorkDateString(new Date('2026-07-15T03:30:00Z'))).toBe('2026-07-14');
  });

  it('uses the previous day for hockey day before 3 AM in New York', () => {
    expect(getHockeyDay(new Date('2026-03-24T05:30:00Z'))).toBe('2026-03-23');
  });

  it('uses the same day for hockey day after the cutoff', () => {
    expect(getHockeyDay(new Date('2026-03-24T08:30:00Z'))).toBe('2026-03-24');
  });

  it('gets the previous New York date correctly across DST boundaries', () => {
    expect(getPreviousNewYorkDateString(new Date('2026-11-02T05:30:00Z'))).toBe('2026-11-01');
  });
});
