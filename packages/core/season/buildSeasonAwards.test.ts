import { describe, expect, it } from 'vitest';

import { buildSeasonAwards, type AwardPlayerInput, type StandingRow } from './buildSeasonAwards';

const standings: StandingRow[] = [
  { rank: 1, teamName: 'Kolya', ownerUid: 'u1', totalPoints: 923.8 },
  { rank: 2, teamName: 'Bozo', ownerUid: 'u2', totalPoints: 896.8 },
  { rank: 3, teamName: 'Kieran', ownerUid: 'u3', totalPoints: 894.9 },
];

// pickNumber 1..N; low pickNumber = drafted early
const players: AwardPlayerInput[] = [
  { playerId: 1, name: 'Ace Scorer', position: 'C', nhlTeam: 'COL', points: 95, draftedByTeam: 'Kolya', round: 1, pickNumber: 1, bestDay: { date: '2026-03-01', points: 6 } },
  { playerId: 2, name: 'Late Gem', position: 'R', nhlTeam: 'BOS', points: 60, draftedByTeam: 'Bozo', round: 8, pickNumber: 40, bestDay: { date: '2026-02-14', points: 9 } },
  { playerId: 3, name: 'Early Flop', position: 'D', nhlTeam: 'TOR', points: 8, draftedByTeam: 'Kieran', round: 1, pickNumber: 2, bestDay: { date: '2026-01-10', points: 2 } },
  { playerId: 4, name: 'Wall Guy', position: 'G', nhlTeam: 'MTL', points: 57, draftedByTeam: 'Kolya', round: 5, pickNumber: 25, bestDay: { date: '2026-02-02', points: 4 } },
];

describe('buildSeasonAwards', () => {
  it('names the MVP by most points', () => {
    expect(buildSeasonAwards(players, standings, 3).awards.mvp?.name).toBe('Ace Scorer');
  });

  it('picks the top goalie among G only', () => {
    expect(buildSeasonAwards(players, standings, 3).awards.topGoalie?.name).toBe('Wall Guy');
  });

  it('best steal rewards finishing above draft slot (late gem, not the elite early pick)', () => {
    // Steal score = draftRank - pointsRank (both among drafted). Late Gem: drafted
    // last (4th) but 2nd in points -> +2. Ace: 1st drafted, 1st in points -> 0.
    // Late Gem out-steals the #1 overall pick.
    expect(buildSeasonAwards(players, standings, 3).awards.bestSteal?.name).toBe('Late Gem');
  });

  it('biggest bust is the lowest-scoring early pick', () => {
    // maxPick 40, threshold ceil(40/3)=14 -> early picks: pickNumber<=14 = Ace(1), Flop(2). min points = Flop
    expect(buildSeasonAwards(players, standings, 3).awards.biggestBust?.name).toBe('Early Flop');
  });

  it('biggest night is the largest single-day points', () => {
    const night = buildSeasonAwards(players, standings, 3).awards.biggestNight;
    expect(night?.name).toBe('Late Gem');
    expect(night?.points).toBe(9);
    expect(night?.date).toBe('2026-02-14');
  });

  it('computes league stats', () => {
    const { stats } = buildSeasonAwards(players, standings, 3);
    expect(stats.totalPoints).toBe(2715.5);
    expect(stats.avgTeamPoints).toBe(905.2);
    expect(stats.runnerUpGap).toBe(27);
  });

  it('summarizes each team with top player and best pick', () => {
    const { teamSummaries } = buildSeasonAwards(players, standings, 3);
    const kolya = teamSummaries.find((t) => t.teamName === 'Kolya')!;
    expect(kolya.topPlayer).toEqual({ name: 'Ace Scorer', points: 95 });
    expect(kolya.bestPick?.name).toBe('Ace Scorer');
    expect(teamSummaries).toHaveLength(3);
  });

  it('guards empty / tiny inputs', () => {
    const empty = buildSeasonAwards([], [], 0);
    expect(empty.awards.mvp).toBeNull();
    expect(empty.awards.biggestBust).toBeNull();
    expect(empty.stats).toEqual({ totalPoints: 0, avgTeamPoints: 0, runnerUpGap: 0 });
    expect(empty.teamSummaries).toEqual([]);
  });
});
