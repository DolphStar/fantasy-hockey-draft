import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_MAX_TEAMS } from '../constants/scoring';
import { toLeagueSummary } from './leagueService';

// `leagueService` imports `src/firebase`, which calls `getAuth(app)` at module load and
// throws `auth/invalid-api-key` without VITE_FIREBASE_* env (e.g. in CI, where .env.local
// is absent). This suite only exercises the pure `toLeagueSummary`, so mock the firebase
// module — vitest hoists this above the import so firebase.ts never runs.
vi.mock('../firebase', () => ({ db: {} }));

describe('toLeagueSummary', () => {
  it('maps a league doc to the hub summary', () => {
    const teams = [{ teamName: 'Kolya', ownerUid: 'u1' }];
    expect(
      toLeagueSummary('abc', {
        leagueName: 'My League',
        memberUids: ['u1'],
        status: 'live',
        teams,
        maxTeams: 6,
        admin: 'u1',
      }),
    ).toEqual({
      id: 'abc',
      leagueName: 'My League',
      status: 'live',
      teams,
      maxTeams: 6,
      admin: 'u1',
    });
  });

  it('falls back to placeholders when the doc is empty', () => {
    expect(toLeagueSummary('abc', {})).toEqual({
      id: 'abc',
      leagueName: 'Untitled League',
      status: 'pending',
      teams: [],
      maxTeams: DEFAULT_MAX_TEAMS,
      admin: null,
    });
  });

  it('carries the league status through (defaulting to pending)', () => {
    expect(toLeagueSummary('L1', { leagueName: 'X', status: 'complete' }).status).toBe('complete');
    expect(toLeagueSummary('L1', { leagueName: 'X' }).status).toBe('pending');
  });

  it('drops team entries that have no name rather than rendering blanks', () => {
    const summary = toLeagueSummary('L1', {
      leagueName: 'X',
      teams: [{ teamName: 'Kolya', ownerUid: 'u1' }, null, { ownerUid: 'u2' }, 'nope'],
    });
    expect(summary.teams).toEqual([{ teamName: 'Kolya', ownerUid: 'u1' }]);
  });

  it('ignores a non-array teams field', () => {
    expect(toLeagueSummary('L1', { leagueName: 'X', teams: 'oops' }).teams).toEqual([]);
  });
});
