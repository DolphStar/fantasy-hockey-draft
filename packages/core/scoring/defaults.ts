import type { ScoringRules } from './types';

/** Default scoring rules for fantasy points */
export const DEFAULT_SCORING_RULES: ScoringRules = {
  goal: 1,
  assist: 1,
  shortHandedGoal: 1,
  overtimeGoal: 1,
  fight: 2,
  blockedShot: 0.15,
  hit: 0.1,
  win: 1,
  shutout: 2,
  save: 0.04,
  goalieAssist: 1,
  goalieGoal: 20,
  goalieFight: 5,
};
