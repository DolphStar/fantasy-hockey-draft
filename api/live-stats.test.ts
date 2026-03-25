import { describe, expect, it } from 'vitest';

import handler from './live-stats';

describe('live-stats route', () => {
  it('default export is a function', () => {
    expect(typeof handler).toBe('function');
  });
});
