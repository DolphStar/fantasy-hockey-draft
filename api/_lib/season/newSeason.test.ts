import { describe, expect, it, vi } from 'vitest';

import { startNewSeason, type NewSeasonDeps } from './newSeason';

const NOW = new Date('2026-09-20T12:00:00Z');

function makeDeps(overrides: Partial<NewSeasonDeps> = {}): NewSeasonDeps {
  return {
    getLeague: vi.fn(async () => ({ status: 'complete', currentSeasonId: '2025-26' })),
    seasonArchiveExists: vi.fn(async () => true),
    deleteLeagueDraftedPlayers: vi.fn(async () => 26),
    deleteDraftDoc: vi.fn(async () => {}),
    deleteSubcollection: vi.fn(async () => 5),
    updateLeague: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('startNewSeason', () => {
  it('wipes season data and resets the league to pending with the next season id', async () => {
    const deps = makeDeps();
    const result = await startNewSeason('L1', deps, NOW);

    expect(result).toEqual({ success: true, newSeasonId: '2026-27' });
    expect(deps.deleteLeagueDraftedPlayers).toHaveBeenCalledWith('L1');
    expect(deps.deleteDraftDoc).toHaveBeenCalledWith('L1');
    for (const name of ['teamScores', 'playerDailyScores', 'aggregates', 'processedDates'] as const) {
      expect(deps.deleteSubcollection).toHaveBeenCalledWith('L1', name);
    }
    expect(deps.updateLeague).toHaveBeenCalledWith('L1', expect.objectContaining({
      status: 'pending',
      currentSeasonId: '2026-27',
      completedAt: null,
    }));
  });

  it('refuses when the league is not complete', async () => {
    const deps = makeDeps({ getLeague: vi.fn(async () => ({ status: 'live', currentSeasonId: '2025-26' })) });
    const result = await startNewSeason('L1', deps, NOW);
    expect(result.success).toBe(false);
    expect(deps.deleteLeagueDraftedPlayers).not.toHaveBeenCalled();
  });

  it('refuses when no season archive exists (history must be safe first)', async () => {
    const deps = makeDeps({ seasonArchiveExists: vi.fn(async () => false) });
    const result = await startNewSeason('L1', deps, NOW);
    expect(result.success).toBe(false);
    expect(deps.deleteLeagueDraftedPlayers).not.toHaveBeenCalled();
  });
});
