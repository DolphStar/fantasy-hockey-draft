import { describe, expect, it, vi } from 'vitest';

import type { DailyGameStats } from './fetchDailyGameStats';
import { scoreLeagueForDate, type ScoreLeagueDeps } from './scoreLeagueForDate';

function makeDeps(overrides: Partial<ScoreLeagueDeps> = {}): ScoreLeagueDeps {
  return {
    getLeague: vi.fn(async () => ({
      status: 'live',
      scoringRules: { fake: true } as never,
      allowedGameTypes: [2],
    })),
    isDateProcessed: vi.fn(async () => false),
    getActiveRoster: vi.fn(async () => [
      { playerId: 100, rosterSlot: 'active', draftedByTeam: 'Alpha' },
    ]),
    persistDailyScores: vi.fn(async () => {}),
    ...overrides,
  };
}

const games: DailyGameStats[] = [{ gameId: 1, gameType: 2, players: [] }];

describe('scoreLeagueForDate', () => {
  it('skips a non-live league without persisting', async () => {
    const deps = makeDeps({ getLeague: vi.fn(async () => ({ status: 'pending' })) });
    const result = await scoreLeagueForDate('L1', '2026-06-13', games, deps);
    expect(result).toMatchObject({ leagueId: 'L1', status: 'skipped', reason: 'not-live' });
    expect(deps.persistDailyScores).not.toHaveBeenCalled();
  });

  it('skips when scoring rules are missing', async () => {
    const deps = makeDeps({
      getLeague: vi.fn(async () => ({ status: 'live', scoringRules: undefined })),
    });
    const result = await scoreLeagueForDate('L1', '2026-06-13', games, deps);
    expect(result).toMatchObject({ status: 'skipped', reason: 'no-scoring-rules' });
    expect(deps.persistDailyScores).not.toHaveBeenCalled();
  });

  it('skips an already-processed date', async () => {
    const deps = makeDeps({ isDateProcessed: vi.fn(async () => true) });
    const result = await scoreLeagueForDate('L1', '2026-06-13', games, deps);
    expect(result).toMatchObject({ status: 'skipped', reason: 'already-processed' });
    expect(deps.persistDailyScores).not.toHaveBeenCalled();
  });

  it('throws when the league does not exist', async () => {
    const deps = makeDeps({ getLeague: vi.fn(async () => null) });
    await expect(scoreLeagueForDate('L1', '2026-06-13', games, deps)).rejects.toThrow();
  });

  it('persists and returns scored when live, ruled, and unprocessed', async () => {
    const deps = makeDeps();
    const result = await scoreLeagueForDate('L1', '2026-06-13', games, deps);
    expect(result.status).toBe('scored');
    expect(deps.persistDailyScores).toHaveBeenCalledOnce();
  });
});
