import { describe, expect, it } from 'vitest';

import { evaluateCronAccess, getPublicCorsHeaders } from './routeAccess';

describe('evaluateCronAccess', () => {
  it('allows a matching cron bearer token', () => {
    expect(
      evaluateCronAccess(
        { headers: { authorization: 'Bearer top-secret' }, query: {} },
        { cronSecret: 'top-secret', nodeEnv: 'production' },
      ),
    ).toEqual({ allowed: true, mode: 'cron' });
  });

  it('rejects requests when the cron secret is missing in production', () => {
    expect(
      evaluateCronAccess(
        { headers: {}, query: {} },
        { cronSecret: '', nodeEnv: 'production' },
      ),
    ).toEqual({
      allowed: false,
      statusCode: 500,
      body: { error: 'CRON_SECRET is not configured' },
    });
  });

  it('refuses an unauthenticated caller in production, whatever the query says', () => {
    // Regression guard: `?returnOnly=true` once let anyone unauthenticated
    // trigger the full NHL fetch + compute on fetch-daily-stats.
    for (const query of [{}, { returnOnly: 'true' }, { leagueId: 'league-1' }]) {
      expect(
        evaluateCronAccess({ headers: {}, query }, { cronSecret: 'top-secret', nodeEnv: 'production' }),
      ).toEqual({ allowed: false, statusCode: 401, body: { error: 'Unauthorized' } });
    }
  });

  it('allows development bypass only when explicitly enabled', () => {
    expect(
      evaluateCronAccess(
        { headers: {}, query: {} },
        { cronSecret: 'top-secret', nodeEnv: 'development' },
        { allowDevBypass: true },
      ),
    ).toEqual({ allowed: true, mode: 'manual-dev' });
  });

  it('still fails closed when a dev bypass is requested but CRON_SECRET is missing', () => {
    expect(
      evaluateCronAccess(
        { headers: {}, query: {} },
        { cronSecret: '', nodeEnv: 'development' },
        { allowDevBypass: true },
      ),
    ).toEqual({
      allowed: false,
      statusCode: 500,
      body: { error: 'CRON_SECRET is not configured' },
    });
  });

  it('does not allow development bypass in production', () => {
    expect(
      evaluateCronAccess(
        { headers: {}, query: {} },
        { cronSecret: 'top-secret', nodeEnv: 'production' },
        { allowDevBypass: true },
      ),
    ).toEqual({
      allowed: false,
      statusCode: 401,
      body: { error: 'Unauthorized' },
    });
  });

  it('rejects unauthorized requests when no bypass applies', () => {
    expect(
      evaluateCronAccess(
        { headers: { authorization: 'Bearer wrong-secret' }, query: {} },
        { cronSecret: 'top-secret', nodeEnv: 'production' },
      ),
    ).toEqual({
      allowed: false,
      statusCode: 401,
      body: { error: 'Unauthorized' },
    });
  });
});

describe('getPublicCorsHeaders', () => {
  it('returns headers for an allowed origin', () => {
    expect(getPublicCorsHeaders('http://localhost:5173')).toEqual({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Origin': 'http://localhost:5173',
    });
  });

  it('omits origin header for an unknown origin', () => {
    expect(getPublicCorsHeaders('https://example.com')).toEqual({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    });
  });
});
