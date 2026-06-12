import { describe, expect, it } from 'vitest';

import { easeOutCubic, formatCount } from './animation';

describe('easeOutCubic', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('decelerates: first half covers more than 50% of distance', () => {
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('formatCount', () => {
  it('keeps the given precision', () => {
    expect(formatCount(1004.0833, 1)).toBe('1004.1');
    expect(formatCount(115, 0)).toBe('115');
  });

  it('handles negatives and zero', () => {
    expect(formatCount(0, 1)).toBe('0.0');
    expect(formatCount(-3.46, 1)).toBe('-3.5');
  });
});
