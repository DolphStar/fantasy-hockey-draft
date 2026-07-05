import { describe, expect, it } from 'vitest';

import { buildSeasonArchive } from './buildSeasonArchive';

const teams = [
  { teamName: 'Kolya', ownerUid: 'u1' },
  { teamName: 'Bozo', ownerUid: 'u2' },
  { teamName: 'Kieran', ownerUid: 'u3' },
];

const base = {
  seasonId: '2025-26',
  endedAt: '2026-07-05T00:00:00.000Z',
  endedBy: 'admin' as const,
  teams,
  teamScores: [
    { teamName: 'Bozo', totalPoints: 896.8 },
    { teamName: 'Kolya', totalPoints: 923.8 },
    { teamName: 'Kieran', totalPoints: 894.9 },
  ],
  playerTotals: [] as never[],
};

describe('buildSeasonArchive', () => {
  it('ranks standings by points desc and crowns the champion', () => {
    const archive = buildSeasonArchive(base);
    expect(archive.standings.map((s) => s.teamName)).toEqual(['Kolya', 'Bozo', 'Kieran']);
    expect(archive.standings[0]).toEqual({ rank: 1, teamName: 'Kolya', ownerUid: 'u1', totalPoints: 923.8 });
    expect(archive.champion).toEqual({ teamName: 'Kolya', ownerUid: 'u1', totalPoints: 923.8 });
    expect(archive.teamCount).toBe(3);
    expect(archive.seasonId).toBe('2025-26');
    expect(archive.endedBy).toBe('admin');
  });

  it('breaks point ties by team name (asc) for deterministic ranking', () => {
    const archive = buildSeasonArchive({
      ...base,
      teamScores: [
        { teamName: 'Bozo', totalPoints: 900 },
        { teamName: 'Kolya', totalPoints: 900 },
      ],
    });
    expect(archive.standings.map((s) => s.teamName)).toEqual(['Bozo', 'Kolya']);
  });

  it('keeps only the top 10 players, ordered by points desc then name', () => {
    const playerTotals = Array.from({ length: 12 }, (_, i) => ({
      playerId: i + 1,
      name: `Player ${String.fromCharCode(65 + i)}`,
      position: 'C',
      nhlTeam: 'MTL',
      points: 100 - i,
      draftedByTeam: 'Kolya',
    }));
    const archive = buildSeasonArchive({ ...base, playerTotals });
    expect(archive.topPlayers).toHaveLength(10);
    expect(archive.topPlayers[0].points).toBe(100);
    expect(archive.topPlayers[9].points).toBe(91);
  });

  it('uses empty-string ownerUid for teams missing from the teams array', () => {
    const archive = buildSeasonArchive({
      ...base,
      teamScores: [{ teamName: 'Ghost', totalPoints: 1 }],
    });
    expect(archive.standings[0].ownerUid).toBe('');
  });

  it('attaches awards, stats, and team summaries from enriched player totals', () => {
    const archive = buildSeasonArchive({
      ...base,
      playerTotals: [
        { playerId: 1, name: 'Ace', position: 'C', nhlTeam: 'COL', points: 95, draftedByTeam: 'Kolya', round: 1, pickNumber: 1, bestDay: { date: '2026-03-01', points: 6 } },
        { playerId: 2, name: 'Keeper', position: 'G', nhlTeam: 'MTL', points: 57, draftedByTeam: 'Bozo', round: 5, pickNumber: 25, bestDay: { date: '2026-02-02', points: 4 } },
      ],
    });
    expect(archive.awards?.mvp?.name).toBe('Ace');
    expect(archive.awards?.topGoalie?.name).toBe('Keeper');
    expect(archive.stats?.totalPoints).toBeGreaterThan(0);
    expect(archive.teamSummaries?.length).toBe(archive.standings.length);
  });
});
