import { describe, expect, it } from 'vitest';

import { mapWithConcurrency } from './concurrency.js';

describe('mapWithConcurrency', () => {
  it('preserves input order in results', async () => {
    const results = await mapWithConcurrency([3, 1, 2], 2, async (n) => {
      await new Promise((resolve) => setTimeout(resolve, n * 5));
      return n * 10;
    });
    expect(results).toEqual([30, 10, 20]);
  });

  it('never exceeds the concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('handles an empty input', async () => {
    expect(await mapWithConcurrency([], 4, async (x) => x)).toEqual([]);
  });
});
