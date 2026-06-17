import { describe, expect, it } from 'vitest';

import handler from './rotate-invite';

function createRes() {
  return {
    statusCode: 0, body: undefined as unknown,
    status(c: number) { this.statusCode = c; return this; },
    json(p: unknown) { this.body = p; return this; },
  };
}

describe('rotate-invite route', () => {
  it('default export is a function', () => { expect(typeof handler).toBe('function'); });
  it('401s without a Bearer token', async () => {
    const res = createRes();
    await handler({ headers: {}, body: { leagueId: 'L1' } } as never, res as never);
    expect(res.statusCode).toBe(401);
  });
});
