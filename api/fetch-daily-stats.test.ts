import { describe, expect, it } from 'vitest';

import handler from './fetch-daily-stats';

describe('fetch-daily-stats route', () => {
  it('default export is a function', () => {
    expect(typeof handler).toBe('function');
  });
});
