import { describe, expect, it } from 'vitest';

import { evaluateAdminAccess } from './adminAuth.js';

const verifyToken = async (token: string) => {
  if (token === 'good-token') return { uid: 'admin-uid' };
  throw new Error('invalid token');
};
const getLeagueAdminUid = async (leagueId: string) =>
  leagueId === 'league-1' ? 'admin-uid' : 'someone-else';

describe('evaluateAdminAccess', () => {
  it('allows the league admin with a valid bearer token', async () => {
    const decision = await evaluateAdminAccess(
      { headers: { authorization: 'Bearer good-token' } },
      'league-1',
      { verifyToken, getLeagueAdminUid },
    );
    expect(decision).toEqual({ allowed: true, uid: 'admin-uid' });
  });

  it('rejects a missing authorization header', async () => {
    const decision = await evaluateAdminAccess({ headers: {} }, 'league-1', {
      verifyToken,
      getLeagueAdminUid,
    });
    expect(decision).toEqual({
      allowed: false,
      statusCode: 401,
      body: { error: 'Unauthorized' },
    });
  });

  it('rejects an invalid token', async () => {
    const decision = await evaluateAdminAccess(
      { headers: { authorization: 'Bearer bad-token' } },
      'league-1',
      { verifyToken, getLeagueAdminUid },
    );
    expect(decision).toEqual({
      allowed: false,
      statusCode: 401,
      body: { error: 'Unauthorized' },
    });
  });

  it('rejects a valid user who is not the league admin', async () => {
    const decision = await evaluateAdminAccess(
      { headers: { authorization: 'Bearer good-token' } },
      'league-2',
      { verifyToken, getLeagueAdminUid },
    );
    expect(decision).toEqual({
      allowed: false,
      statusCode: 403,
      body: { error: 'Forbidden: not the league admin' },
    });
  });
});
