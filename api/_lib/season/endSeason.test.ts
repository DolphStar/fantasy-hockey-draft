import { describe, expect, it, vi } from 'vitest';

import { endSeason, reopenSeason, type EndSeasonDeps } from './endSeason';

const NOW = new Date('2026-07-05T12:00:00Z');

function makeDeps(overrides: Partial<EndSeasonDeps> = {}): EndSeasonDeps {
  return {
    getLeague: vi.fn(async () => ({
      status: 'live',
      teams: [
        { teamName: 'Kolya', ownerUid: 'u1' },
        { teamName: 'Bozo', ownerUid: 'u2' },
      ],
      currentSeasonId: undefined,
    })),
    getTeamScores: vi.fn(async () => [
      { teamName: 'Kolya', totalPoints: 923.8 },
      { teamName: 'Bozo', totalPoints: 896.8 },
    ]),
    getPlayerTotals: vi.fn(async () => []),
    getPendingSwapDocIds: vi.fn(async () => ['swapA', 'swapB']),
    writeSeasonArchive: vi.fn(async () => {}),
    updateLeague: vi.fn(async () => {}),
    clearPendingSwap: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('endSeason', () => {
  it('writes the archive, completes the league, and clears pending swaps', async () => {
    const deps = makeDeps();
    const result = await endSeason('L1', 'admin', deps, NOW);

    expect(result).toEqual({ success: true, seasonId: '2025-26', champion: 'Kolya' });
    expect(deps.writeSeasonArchive).toHaveBeenCalledWith('L1', expect.objectContaining({
      seasonId: '2025-26',
      endedBy: 'admin',
      champion: expect.objectContaining({ teamName: 'Kolya' }),
    }));
    expect(deps.updateLeague).toHaveBeenCalledWith('L1', expect.objectContaining({
      status: 'complete',
      currentSeasonId: '2025-26',
      completedAt: NOW.toISOString(),
    }));
    expect(deps.clearPendingSwap).toHaveBeenCalledTimes(2);
  });

  it('prefers the league currentSeasonId over the date-derived one', async () => {
    const deps = makeDeps({
      getLeague: vi.fn(async () => ({ status: 'live', teams: [], currentSeasonId: '2024-25' })),
    });
    const result = await endSeason('L1', 'auto', deps, NOW);
    expect(result).toEqual(expect.objectContaining({ success: true, seasonId: '2024-25' }));
  });

  it('fails on a pending league and on a missing league', async () => {
    const pending = makeDeps({ getLeague: vi.fn(async () => ({ status: 'pending', teams: [] })) });
    expect((await endSeason('L1', 'admin', pending, NOW)).success).toBe(false);

    const missing = makeDeps({ getLeague: vi.fn(async () => null) });
    expect((await endSeason('L1', 'admin', missing, NOW)).success).toBe(false);
  });

  it('is idempotent: re-ending a complete league rewrites the archive', async () => {
    const deps = makeDeps({
      getLeague: vi.fn(async () => ({ status: 'complete', teams: [], currentSeasonId: '2025-26' })),
    });
    const result = await endSeason('L1', 'admin', deps, NOW);
    expect(result.success).toBe(true);
    expect(deps.writeSeasonArchive).toHaveBeenCalled();
  });
});

describe('reopenSeason', () => {
  it('reverts a complete league to live', async () => {
    const deps = makeDeps({
      getLeague: vi.fn(async () => ({ status: 'complete', teams: [], currentSeasonId: '2025-26' })),
    });
    const result = await reopenSeason('L1', deps);
    expect(result.success).toBe(true);
    expect(deps.updateLeague).toHaveBeenCalledWith('L1', expect.objectContaining({
      status: 'live',
      completedAt: null,
    }));
  });

  it('refuses to reopen a league that is not complete', async () => {
    const deps = makeDeps();
    expect((await reopenSeason('L1', deps)).success).toBe(false);
  });
});
