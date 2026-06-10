import { describe, expect, it } from 'vitest';

import handler from './calculate-scores';

function createRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('calculate-scores route', () => {
  it('default export is a function', () => {
    expect(typeof handler).toBe('function');
  });

  it('returns 400 when no league ID is provided', async () => {
    const previousDefault = process.env.DEFAULT_LEAGUE_ID;
    delete process.env.DEFAULT_LEAGUE_ID;
    try {
      const res = createRes();
      await handler({ query: {}, headers: {} } as never, res as never);
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: 'No league ID provided' });
    } finally {
      if (previousDefault !== undefined) process.env.DEFAULT_LEAGUE_ID = previousDefault;
    }
  });

  it('returns 400 for a malformed date before any auth runs', async () => {
    const res = createRes();
    await handler(
      { query: { leagueId: 'league-1', date: '06/09/2026' }, headers: {} } as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid date; expected YYYY-MM-DD' });
  });
});
