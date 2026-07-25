import { describe, expect, it } from 'vitest';

import {
  getHockeyDay,
  getNewYorkDateString,
  getPreviousNewYorkDateString,
  getRecentNewYorkDateStrings,
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

describe('getRecentNewYorkDateStrings', () => {
  it('returns the days before today in New York, most recent first', () => {
    expect(getRecentNewYorkDateStrings(3, new Date('2026-01-15T18:00:00Z'))).toEqual([
      '2026-01-14',
      '2026-01-13',
      '2026-01-12',
    ]);
  });

  it('anchors to New York, not UTC', () => {
    // 03:30 UTC on the 15th is still 22:30 ET on the 14th, so the most recent
    // completed day is the 13th. A UTC-based list would start at the 14th.
    expect(getRecentNewYorkDateStrings(2, new Date('2026-01-15T03:30:00Z'))).toEqual([
      '2026-01-13',
      '2026-01-12',
    ]);
  });

  it('crosses a month boundary', () => {
    expect(getRecentNewYorkDateStrings(3, new Date('2026-03-02T18:00:00Z'))).toEqual([
      '2026-03-01',
      '2026-02-28',
      '2026-02-27',
    ]);
  });

  it('does not skip or repeat a day across the spring DST change', () => {
    // US DST starts 2026-03-08.
    expect(getRecentNewYorkDateStrings(4, new Date('2026-03-10T18:00:00Z'))).toEqual([
      '2026-03-09',
      '2026-03-08',
      '2026-03-07',
      '2026-03-06',
    ]);
  });

  it('returns an empty list for a count of zero', () => {
    expect(getRecentNewYorkDateStrings(0, new Date('2026-01-15T18:00:00Z'))).toEqual([]);
  });
});
