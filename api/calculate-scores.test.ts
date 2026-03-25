import { describe, expect, it } from 'vitest';

import handler from './calculate-scores';

describe('calculate-scores route', () => {
  it('default export is a function', () => {
    expect(typeof handler).toBe('function');
  });
});
