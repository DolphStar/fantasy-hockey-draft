import { describe, expect, it } from 'vitest';

import type { GoalEventStats } from '../../../packages/core/nhl/parseGoalEvents';
import type { PlayerGameStats } from '../../../packages/core/nhl/types';
import {
  applyDerivedStats,
  countFightsFromPlayByPlay,
  filterGameStatsByType,
  type DailyGameStats,
} from './fetchDailyGameStats';

const game = (gameId: number, gameType: number): DailyGameStats => ({
  gameId,
  gameType,
  players: [],
});

describe('filterGameStatsByType', () => {
  it('keeps only games whose gameType is allowed and counts the rest', () => {
    const games = [game(1, 2), game(2, 3), game(3, 2)];
    const { included, skippedTypeCount } = filterGameStatsByType(games, [2]);
    expect(included.map((g) => g.gameId)).toEqual([1, 3]);
    expect(skippedTypeCount).toBe(1);
  });

  it('returns everything when all types are allowed', () => {
    const games = [game(1, 2), game(2, 3)];
    const { included, skippedTypeCount } = filterGameStatsByType(games, [2, 3]);
    expect(included).toHaveLength(2);
    expect(skippedTypeCount).toBe(0);
  });
});

describe('countFightsFromPlayByPlay', () => {
  it('counts fighting penalties per committing player', () => {
    const pbp = {
      plays: [
        { typeDescKey: 'penalty', details: { descKey: 'fighting', committedByPlayerId: 10 } },
        { typeDescKey: 'penalty', details: { descKey: 'fighting', committedByPlayerId: 10 } },
        { typeDescKey: 'penalty', details: { descKey: 'hooking', committedByPlayerId: 20 } },
        { typeDescKey: 'goal', details: {} },
      ],
    };
    const counts = countFightsFromPlayByPlay(pbp);
    expect(counts.get(10)).toBe(2);
    expect(counts.has(20)).toBe(false);
  });

  it('returns an empty map for malformed input', () => {
    expect(countFightsFromPlayByPlay(null).size).toBe(0);
    expect(countFightsFromPlayByPlay({}).size).toBe(0);
  });
});

describe('applyDerivedStats', () => {
  const skater = (over: Partial<PlayerGameStats>): PlayerGameStats => ({
    playerId: 1,
    name: { default: 'Skater' },
    position: 'C',
    ...over,
  });

  const goalEvents = (entries: [number, Partial<GoalEventStats>][]) =>
    new Map<number, GoalEventStats>(
      entries.map(([id, s]) => [
        id,
        { goals: 0, assists: 0, shortHandedGoals: 0, overtimeGoals: 0, ...s },
      ]),
    );

  it('sets fights, SHG and OTG on skaters and maps sog to shots', () => {
    const player = skater({ playerId: 7, goals: 2, sog: 5 });
    applyDerivedStats(
      [player],
      new Map([[7, 1]]),
      goalEvents([[7, { goals: 2, shortHandedGoals: 1, overtimeGoals: 1 }]]),
    );
    expect(player.fights).toBe(1);
    expect(player.shortHandedGoals).toBe(1);
    expect(player.overtimeGoals).toBe(1);
    expect(player.shots).toBe(5);
    // boxscore skater goals/assists are authoritative — not overwritten
    expect(player.goals).toBe(2);
  });

  it('derives goalie wins/shutouts and fills goalie goals/assists from goal events', () => {
    const goalie = skater({
      playerId: 9,
      position: 'G',
      decision: 'W',
      goalsAgainst: 0,
      saves: 22,
    });
    applyDerivedStats([goalie], new Map(), goalEvents([[9, { assists: 1 }]]));
    expect(goalie.wins).toBe(1);
    expect(goalie.shutouts).toBe(1);
    expect(goalie.goals).toBe(0);
    expect(goalie.assists).toBe(1);
  });

  it('zeroes derived fields when no events exist for the player', () => {
    const goalie = skater({ playerId: 9, position: 'G', decision: 'L', goalsAgainst: 5, saves: 17 });
    applyDerivedStats([goalie], new Map(), new Map());
    expect(goalie.wins).toBe(0);
    expect(goalie.shutouts).toBe(0);
    expect(goalie.goals).toBe(0);
    expect(goalie.assists).toBe(0);
    expect(goalie.fights).toBe(0);
  });
});
