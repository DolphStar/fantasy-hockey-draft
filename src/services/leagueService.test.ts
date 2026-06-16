import { describe, expect, it } from 'vitest';

import { toLeagueSummary } from './leagueService';

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
