import { afterEach, describe, expect, it, vi } from 'vitest';

import { easeOutCubic, formatCount, hasCountUpPlayed, markCountUpPlayed } from './animation';

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

describe('count-up session gate', () => {
  const fakeStorage = () => {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    } as unknown as Storage;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a scope as unplayed until it is marked', () => {
    vi.stubGlobal('sessionStorage', fakeStorage());

    expect(hasCountUpPlayed('standings-points')).toBe(false);
    markCountUpPlayed('standings-points');
    expect(hasCountUpPlayed('standings-points')).toBe(true);
  });

  it('keeps surfaces independent', () => {
    vi.stubGlobal('sessionStorage', fakeStorage());

    markCountUpPlayed('standings-points');

    expect(hasCountUpPlayed('my-roster-points')).toBe(false);
  });

  it('never gates when no scope is given', () => {
    vi.stubGlobal('sessionStorage', fakeStorage());

    markCountUpPlayed(undefined);

    expect(hasCountUpPlayed(undefined)).toBe(false);
  });

  it('falls back to animating when storage throws', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    } as unknown as Storage);

    expect(() => markCountUpPlayed('standings-points')).not.toThrow();
    expect(hasCountUpPlayed('standings-points')).toBe(false);
  });
});
