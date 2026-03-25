import { describe, expect, it } from 'vitest';

import {
  getHockeyDay,
  getNewYorkDateString,
  getPreviousNewYorkDateString,
  parseNewYorkHourString,
} from './dateUtils';

describe('dateUtils (core)', () => {
  it('formats the current New York calendar day without a hardcoded offset', () => {
    expect(getNewYorkDateString(new Date('2026-07-15T03:30:00Z'))).toBe('2026-07-14');
  });

  it('uses the previous day for hockey day before 3 AM in New York', () => {
    expect(getHockeyDay(new Date('2026-03-24T05:30:00Z'))).toBe('2026-03-23');
  });

  it('uses the same day for hockey day after the cutoff', () => {
    expect(getHockeyDay(new Date('2026-03-24T08:30:00Z'))).toBe('2026-03-24');
  });

  it('uses the previous calendar day at 2:59 AM ET (just before 3 AM cutoff)', () => {
    // EDT: 2026-03-24 02:59 ET == 06:59 UTC
    expect(getHockeyDay(new Date('2026-03-24T06:59:00.000Z'))).toBe('2026-03-23');
    // EST: 2026-01-15 02:59 ET == 07:59 UTC
    expect(getHockeyDay(new Date('2026-01-15T07:59:00.000Z'))).toBe('2026-01-14');
  });

  it('uses the current calendar day at exactly 3:00 AM ET (inclusive cutoff)', () => {
    // EDT: 2026-03-24 03:00 ET == 07:00 UTC
    expect(getHockeyDay(new Date('2026-03-24T07:00:00.000Z'))).toBe('2026-03-24');
    // EST: 2026-01-15 03:00 ET == 08:00 UTC
    expect(getHockeyDay(new Date('2026-01-15T08:00:00.000Z'))).toBe('2026-01-15');
  });

  it('rejects non-numeric hour strings from the formatter', () => {
    expect(() => parseNewYorkHourString('??')).toThrow(RangeError);
    expect(() => parseNewYorkHourString('')).toThrow(RangeError);
    expect(() => parseNewYorkHourString('3am')).toThrow(RangeError);
  });

  it('accepts valid 0-23 hour strings from the formatter', () => {
    expect(parseNewYorkHourString('0')).toBe(0);
    expect(parseNewYorkHourString('02')).toBe(2);
    expect(parseNewYorkHourString('23')).toBe(23);
  });

  it('gets the previous New York date correctly across DST boundaries', () => {
    expect(getPreviousNewYorkDateString(new Date('2026-11-02T05:30:00Z'))).toBe('2026-11-01');
  });
});
