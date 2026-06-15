import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
  let previousSecret: string | undefined;

  beforeEach(() => {
    previousSecret = process.env.CRON_SECRET;
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  });

  it('default export is a function', () => {
    expect(typeof handler).toBe('function');
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

  it('rejects an all-leagues run (no leagueId) without cron auth', async () => {
    process.env.CRON_SECRET = 'test-secret';
    const res = createRes();
    await handler({ query: {}, headers: {} } as never, res as never);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});
