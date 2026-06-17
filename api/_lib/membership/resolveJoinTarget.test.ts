import { describe, expect, it } from 'vitest';

import { resolveJoinTarget } from './resolveJoinTarget';

const team = (ownerUid: string) => ({ teamName: 'T', ownerUid });

describe('resolveJoinTarget', () => {
  it('returns "already" when the uid already owns a team', () => {
    expect(resolveJoinTarget([team('me')], 4, 'me')).toEqual({ kind: 'already' });
  });
  it('claims the first open slot (empty ownerUid)', () => {
    expect(resolveJoinTarget([team('a'), team(''), team('')], 4, 'me')).toEqual({ kind: 'claim', index: 1 });
  });
  it('appends when no open slot and under the cap', () => {
    expect(resolveJoinTarget([team('a'), team('b')], 4, 'me')).toEqual({ kind: 'append' });
  });
  it('is full when no open slot and at the cap', () => {
    expect(resolveJoinTarget([team('a'), team('b')], 2, 'me')).toEqual({ kind: 'full' });
  });
});
