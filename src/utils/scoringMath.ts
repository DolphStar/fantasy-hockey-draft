import type { ScoringRules } from '../types/league';
import type { PlayerGameStats } from './nhlStats';

function calculateSkaterPoints(
  stats: PlayerGameStats,
  rules: ScoringRules,
  isDefenseman: boolean,
): number {
  let points = 0;

  points += (stats.goals || 0) * rules.goal;
  points += (stats.assists || 0) * rules.assist;
  points += (stats.shortHandedGoals || 0) * rules.shortHandedGoal;
  // Overtime goal scoring stays in the config shape, but the current boxscore
  // payload does not expose a separate OT-goal count for skaters.
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
  if (stats.position === 'G') {
    return calculateGoaliePoints(stats, rules);
  }

  return calculateSkaterPoints(stats, rules, stats.position === 'D');
}
