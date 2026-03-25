import type { PlayerGameStats } from '../nhl/types.js';

import type { ScoringRules } from './types.js';

const GOALIE_POSITION = 'G';
const DEFENSE_POSITION = 'D';

function normalizePosition(position: unknown): string | null {
  if (typeof position !== 'string') {
    return null;
  }

  return position;
}

function hasExactPosition(position: unknown, expectedPosition: string): boolean {
  const normalizedPosition = normalizePosition(position);

  return normalizedPosition === expectedPosition;
}

function isGoaliePosition(position: unknown): boolean {
  return hasExactPosition(position, GOALIE_POSITION);
}

function isDefensePosition(position: unknown): boolean {
  return hasExactPosition(position, DEFENSE_POSITION);
}

function calculateSkaterPoints(
  stats: PlayerGameStats,
  rules: ScoringRules,
  isDefenseman: boolean,
): number {
  let points = 0;

  points += (stats.goals || 0) * rules.goal;
  points += (stats.assists || 0) * rules.assist;
  points += (stats.shortHandedGoals || 0) * rules.shortHandedGoal;
  // `overtimeGoal` stays in the shared rules shape for config stability, but
  // current player game stats do not expose a distinct OT-goal count to score.
  points += (stats.fights || 0) * rules.fight;

  if (isDefenseman) {
    points += (stats.blockedShots || 0) * rules.blockedShot;
    points += (stats.hits || 0) * rules.hit;
  }

  return points;
}

function calculateGoaliePoints(
  stats: PlayerGameStats,
  rules: ScoringRules,
): number {
  let points = 0;

  points += (stats.wins || 0) * rules.win;
  points += (stats.shutouts || 0) * rules.shutout;
  points += (stats.saves || 0) * rules.save;
  points += (stats.assists || 0) * rules.goalieAssist;
  points += (stats.goals || 0) * rules.goalieGoal;
  points += (stats.fights || 0) * rules.goalieFight;

  return points;
}

export function calculatePlayerPoints(
  stats: PlayerGameStats,
  rules: ScoringRules,
): number {
  if (isGoaliePosition(stats.position)) {
    return calculateGoaliePoints(stats, rules);
  }

  return calculateSkaterPoints(stats, rules, isDefensePosition(stats.position));
}
