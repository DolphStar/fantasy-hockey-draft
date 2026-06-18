import { describe, expect, it } from 'vitest';

import { canRequestJoin, type RequestableLeague } from './canRequestJoin';

const base: RequestableLeague = {
  isPublic: true,
  status: 'pending',
  teams: [{ teamName: 'A', ownerUid: 'a' }, { teamName: 'B', ownerUid: '' }],
  maxTeams: 4,
};

describe('canRequestJoin', () => {
  it('allows a non-member to request a public, pending, non-full league', () => {
    expect(canRequestJoin(base, 'me', false)).toBe(true);
  });
  it('blocks when not public', () => {
    expect(canRequestJoin({ ...base, isPublic: false }, 'me', false)).toBe(false);
  });
  it('blocks when the draft is not pending', () => {
    expect(canRequestJoin({ ...base, status: 'live' }, 'me', false)).toBe(false);
  });
  it('blocks when the user already has a pending request', () => {
    expect(canRequestJoin(base, 'me', true)).toBe(false);
  });
  it('blocks an existing member', () => {
    expect(canRequestJoin(base, 'a', false)).toBe(false);
  });
  it('blocks when the league is full (no open slot, at cap)', () => {
    const full: RequestableLeague = {
      isPublic: true,
      status: 'pending',
      teams: [{ teamName: 'A', ownerUid: 'a' }, { teamName: 'B', ownerUid: 'b' }],
      maxTeams: 2,
    };
    expect(canRequestJoin(full, 'me', false)).toBe(false);
  });
});
