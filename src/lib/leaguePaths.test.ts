import { describe, expect, it } from 'vitest';

import { buildLeaguePath, pickDefaultLeague } from './leaguePaths';

describe('buildLeaguePath', () => {
  it('builds the league root with no subpath', () => {
    expect(buildLeaguePath('L1')).toBe('/l/L1');
  });
  it('appends a subpath', () => {
    expect(buildLeaguePath('L1', 'scores')).toBe('/l/L1/scores');
    expect(buildLeaguePath('L1', 'players/browse')).toBe('/l/L1/players/browse');
  });
  it('tolerates a leading slash on the subpath', () => {
    expect(buildLeaguePath('L1', '/scores')).toBe('/l/L1/scores');
  });
});

describe('pickDefaultLeague', () => {
  const leagues = [{ id: 'A', leagueName: 'A' }, { id: 'B', leagueName: 'B' }];

  it('returns the last-used league when still a member', () => {
    expect(pickDefaultLeague(leagues, 'B')).toBe('B');
  });
  it('falls back to the first membership when last-used is stale', () => {
    expect(pickDefaultLeague(leagues, 'GONE')).toBe('A');
  });
  it('falls back to the first membership when no last-used', () => {
    expect(pickDefaultLeague(leagues, null)).toBe('A');
  });
  it('returns null when the user has no leagues', () => {
    expect(pickDefaultLeague([], 'A')).toBeNull();
  });
});
