import { describe, expect, it } from 'vitest';

import { getPreviousNewYorkDateString } from './dateUtils';

describe('functions dateUtils', () => {
  it('gets yesterday in New York without a hardcoded EST offset', () => {
    expect(getPreviousNewYorkDateString(new Date('2026-07-15T03:30:00Z'))).toBe('2026-07-13');
  });
});
