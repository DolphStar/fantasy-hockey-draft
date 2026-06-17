import { describe, expect, it } from 'vitest';

import handler from './join-league';

function createRes() {
  return {
    statusCode: 0,
    body: undefined as unknown,
    status(c: number) { this.statusCode = c; return this; },
    json(p: unknown) { this.body = p; return this; },
  };
}

describe('join-league route', () => {
  it('default export is a function', () => {
    expect(typeof handler).toBe('function');
  });
  it('401s without a Bearer token (auth runs before body validation)', async () => {
    const res = createRes();
    await handler({ headers: {}, body: { code: 'X', teamName: 'T' } } as never, res as never);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});
