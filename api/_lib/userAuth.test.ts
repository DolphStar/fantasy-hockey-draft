import { describe, expect, it } from 'vitest';

import { evaluateUserAccess, type UserAccessDeps } from './userAuth';

const deps = (uid = 'u1'): UserAccessDeps => ({ verifyToken: async () => ({ uid }) });

describe('evaluateUserAccess', () => {
  it('rejects a missing Bearer token with 401', async () => {
    const res = await evaluateUserAccess({ headers: {} }, deps());
    expect(res).toEqual({ allowed: false, statusCode: 401, body: { error: 'Unauthorized' } });
  });
  it('rejects an invalid token with 401', async () => {
    const failing: UserAccessDeps = { verifyToken: async () => { throw new Error('bad'); } };
    const res = await evaluateUserAccess({ headers: { authorization: 'Bearer x' } }, failing);
    expect(res).toEqual({ allowed: false, statusCode: 401, body: { error: 'Unauthorized' } });
  });
  it('allows a valid token and returns the uid', async () => {
    const res = await evaluateUserAccess({ headers: { authorization: 'Bearer good' } }, deps('abc'));
    expect(res).toEqual({ allowed: true, uid: 'abc' });
  });
});
