import { describe, expect, it } from 'vitest';

import type { AggregatedPlayerScore } from './aggregateDailyScores';
import { buildTeamAggregate, foldDailyScores, summaryFromAggregate } from './seasonAggregate';

const TEAM = 'Team A';

function score(
  o: Partial<AggregatedPlayerScore> & { playerId: number; date: string; points: number },
): AggregatedPlayerScore {
  return { playerName: `Player ${o.playerId}`, teamName: TEAM, nhlTeam: 'EDM', stats: {}, ...o };
}

const D1 = '2026-01-01';
const D2 = '2026-01-02';

describe('foldDailyScores / buildTeamAggregate', () => {
  const scores: AggregatedPlayerScore[] = [
    score({ playerId: 1, date: D1, points: 2, stats: { goals: 1, assists: 1 } }),
    score({ playerId: 2, date: D1, points: 1, stats: { goals: 0, assists: 1 } }),
    score({ playerId: 1, date: D2, points: 4, stats: { goals: 2, assists: 0 } }),
  ];

  it('accumulates per-player season totals across days', () => {
    const agg = buildTeamAggregate(TEAM, scores);
    expect(agg.players[1]).toEqual({
      points: 6,
      goals: 3,
      assists: 1,
      gamesPlayed: 2,
      recent: [
        { date: D1, points: 2 },
        { date: D2, points: 4 },
      ],
    });
    expect(agg.players[2]).toEqual({
      points: 1,
      goals: 0,
      assists: 1,
      gamesPlayed: 1,
      recent: [{ date: D1, points: 1 }],
    });
  });

  it('sums positive performances into date-ascending dailyTotals', () => {
    const agg = buildTeamAggregate(TEAM, scores);
    expect(agg.dailyTotals).toEqual([
      { date: D1, points: 3 },
      { date: D2, points: 4 },
    ]);
  });

  it('keeps only the last 5 days of recent history, by date', () => {
    const sixDays: AggregatedPlayerScore[] = ['01', '02', '03', '04', '05', '06'].map((d, i) =>
      score({ playerId: 7, date: `2026-02-${d}`, points: i + 1 }),
    );
    const agg = buildTeamAggregate(TEAM, sixDays);
    expect(agg.players[7].recent).toEqual([
      { date: '2026-02-02', points: 2 },
      { date: '2026-02-03', points: 3 },
      { date: '2026-02-04', points: 4 },
      { date: '2026-02-05', points: 5 },
      { date: '2026-02-06', points: 6 },
    ]);
    expect(agg.players[7].gamesPlayed).toBe(6);
  });

  it('folds day-by-day identically to a single bulk build (associative)', () => {
    const incremental = foldDailyScores(
      foldDailyScores(null, TEAM, [scores[0], scores[1]]),
      TEAM,
      [scores[2]],
    );
    expect(incremental).toEqual(buildTeamAggregate(TEAM, scores));
  });
});

describe('summaryFromAggregate', () => {
  const scores: AggregatedPlayerScore[] = [
    score({ playerId: 1, date: D1, points: 2, stats: { goals: 1, assists: 1 } }),
    score({ playerId: 2, date: D1, points: 1, stats: { goals: 0, assists: 1 } }),
    score({ playerId: 1, date: D2, points: 4, stats: { goals: 2, assists: 0 } }),
  ];

  it('derives pointsMap, statsMap (with avgPoints), and historyMap', () => {
    const summary = summaryFromAggregate(buildTeamAggregate(TEAM, scores));
    expect(summary.pointsMap).toEqual({ 1: 6, 2: 1 });
    expect(summary.statsMap[1]).toEqual({ goals: 3, assists: 1, gamesPlayed: 2, avgPoints: 3 });
    expect(summary.statsMap[2]).toEqual({ goals: 0, assists: 1, gamesPlayed: 1, avgPoints: 1 });
    expect(summary.historyMap[1]).toEqual([
      { date: D1, points: 2 },
      { date: D2, points: 4 },
    ]);
  });

  it('reports dailyTeamTotals, lastGamePoints, and an upward trend', () => {
    const summary = summaryFromAggregate(buildTeamAggregate(TEAM, scores));
    expect(summary.dailyTeamTotals).toEqual([
      { date: D1, points: 3 },
      { date: D2, points: 4 },
    ]);
    expect(summary.lastGamePoints).toBe(4);
    expect(summary.trend).toBe('up');
  });

  it('returns a neutral, empty summary for an empty aggregate', () => {
    const summary = summaryFromAggregate(buildTeamAggregate(TEAM, []));
    expect(summary.pointsMap).toEqual({});
    expect(summary.dailyTeamTotals).toEqual([]);
    expect(summary.lastGamePoints).toBe(0);
    expect(summary.trend).toBe('neutral');
  });
});
