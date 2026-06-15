import { describe, expect, it, vi } from 'vitest';

import type { DailyGameStats } from './fetchDailyGameStats';
import { runDailyScoring, type DailyScoringDeps } from './runDailyScoring';
import type { ScoreLeagueResult } from './scoreLeagueForDate';

const GAMES: DailyGameStats[] = [{ gameId: 1, gameType: 2, players: [] }];

function makeDeps(overrides: Partial<DailyScoringDeps> = {}): DailyScoringDeps {
  return {
    now: () => new Date('2026-06-13T12:00:00Z'),
    resolveDate: ({ date }) => date ?? '2026-06-12',
    listLiveLeagueIds: vi.fn(async () => ['A', 'B', 'C']),
    fetchDailyGameStats: vi.fn(async () => GAMES),
    applyRosterSwaps: vi.fn(async () => ({ success: true, swapsApplied: 1 })),
    scoreLeagueForDate: vi.fn(
      async (leagueId): Promise<ScoreLeagueResult> => ({ leagueId, status: 'scored' }),
    ),
    ...overrides,
  };
}

describe('runDailyScoring', () => {
  it('fetches NHL data exactly once and scores every live league', async () => {
    const deps = makeDeps();
    const summary = await runDailyScoring(deps, {});

    expect(deps.fetchDailyGameStats).toHaveBeenCalledOnce();
    expect(deps.fetchDailyGameStats).toHaveBeenCalledWith('2026-06-12');
    expect(summary.date).toBe('2026-06-12');
    expect(summary.leaguesScored).toBe(3);
    expect(summary.rosterSwapsApplied).toBe(3);
  });

  it('isolates a failing league without aborting the rest', async () => {
    const deps = makeDeps({
      scoreLeagueForDate: vi.fn(async (leagueId): Promise<ScoreLeagueResult> => {
        if (leagueId === 'B') throw new Error('boom');
        return { leagueId, status: 'scored' };
      }),
    });

    const summary = await runDailyScoring(deps, {});

    expect(summary.leaguesScored).toBe(2);
    expect(summary.leaguesErrored).toBe(1);
    expect(summary.results.find((r) => r.leagueId === 'B')).toMatchObject({
      status: 'error',
      error: 'boom',
    });
  });

  it('counts skipped leagues', async () => {
    const deps = makeDeps({
      scoreLeagueForDate: vi.fn(async (leagueId): Promise<ScoreLeagueResult> =>
        leagueId === 'C'
          ? { leagueId, status: 'skipped', reason: 'not-live' }
          : { leagueId, status: 'scored' },
      ),
    });
    const summary = await runDailyScoring(deps, {});
    expect(summary.leaguesScored).toBe(2);
    expect(summary.leaguesSkipped).toBe(1);
  });

  it('single-league mode scores only that league and never lists live leagues', async () => {
    const deps = makeDeps();
    const summary = await runDailyScoring(deps, { leagueId: 'X', date: '2026-01-01' });

    expect(deps.listLiveLeagueIds).not.toHaveBeenCalled();
    expect(deps.fetchDailyGameStats).toHaveBeenCalledWith('2026-01-01');
    expect(summary.results).toHaveLength(1);
    expect(summary.results[0].leagueId).toBe('X');
  });
});
