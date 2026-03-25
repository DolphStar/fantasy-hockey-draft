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

  it('allows a documented query bypass when configured', () => {
    expect(
      evaluateCronAccess(
        { headers: {}, query: { returnOnly: 'true' } },
        { cronSecret: 'top-secret', nodeEnv: 'production' },
        { allowQueryBypass: { param: 'returnOnly', value: 'true' } },
      ),
    ).toEqual({ allowed: true, mode: 'manual-query' });
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

  it('still fails closed when a bypass is requested but CRON_SECRET is missing', () => {
    expect(
      evaluateCronAccess(
        { headers: {}, query: { returnOnly: 'true' } },
        { cronSecret: '', nodeEnv: 'production' },
        { allowQueryBypass: { param: 'returnOnly', value: 'true' } },
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
