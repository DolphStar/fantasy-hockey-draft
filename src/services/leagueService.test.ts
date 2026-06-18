import { describe, expect, it, vi } from 'vitest';

import { toLeagueSummary } from './leagueService';

// `leagueService` imports `src/firebase`, which calls `getAuth(app)` at module load and
// throws `auth/invalid-api-key` without VITE_FIREBASE_* env (e.g. in CI, where .env.local
// is absent). This suite only exercises the pure `toLeagueSummary`, so mock the firebase
// module — vitest hoists this above the import so firebase.ts never runs.
vi.mock('../firebase', () => ({ db: {} }));

describe('toLeagueSummary', () => {
  it('maps a league doc to id + leagueName', () => {
    expect(toLeagueSummary('abc', { leagueName: 'My League', memberUids: ['u1'] })).toEqual({
      id: 'abc',
      leagueName: 'My League',
    });
  });

  it('falls back to a placeholder name when leagueName is missing', () => {
    expect(toLeagueSummary('abc', {})).toEqual({ id: 'abc', leagueName: 'Untitled League' });
  });
});
