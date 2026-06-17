import { describe, expect, it, vi } from 'vitest';

import { joinLeague, type JoinLeagueDeps } from './joinLeague';

function deps(over: Partial<JoinLeagueDeps> = {}): JoinLeagueDeps {
  return {
    resolveCode: vi.fn(async () => 'L1'),
    applyJoin: vi.fn(async () => 'joined' as const),
    ...over,
  };
}

describe('joinLeague', () => {
  it('404s an unknown code', async () => {
    const d = deps({ resolveCode: vi.fn(async () => null) });
    const r = await joinLeague(d, { uid: 'u', code: 'BAD', teamName: 'T' });
    expect(r).toMatchObject({ status: 'error', statusCode: 404 });
    expect(d.applyJoin).not.toHaveBeenCalled();
  });
  it('returns joined leagueId on a successful claim/append', async () => {
    const r = await joinLeague(deps(), { uid: 'u', code: 'OK', teamName: 'T' });
    expect(r).toEqual({ status: 'joined', leagueId: 'L1' });
  });
  it('treats already-a-member as success', async () => {
    const r = await joinLeague(deps({ applyJoin: vi.fn(async () => 'already') }), { uid: 'u', code: 'OK', teamName: 'T' });
    expect(r).toEqual({ status: 'joined', leagueId: 'L1' });
  });
  it('409s a full league', async () => {
    const r = await joinLeague(deps({ applyJoin: vi.fn(async () => 'full') }), { uid: 'u', code: 'OK', teamName: 'T' });
    expect(r).toMatchObject({ status: 'error', statusCode: 409 });
  });
  it('409s a league that already drafted', async () => {
    const r = await joinLeague(deps({ applyJoin: vi.fn(async () => 'not-pending') }), { uid: 'u', code: 'OK', teamName: 'T' });
    expect(r).toMatchObject({ status: 'error', statusCode: 409 });
  });
});
