export interface ScoringRules {
  goal: number;
  assist: number;
  shortHandedGoal: number;
  /** Bonus on top of the goal itself; derived from the landing goal summary. */
  overtimeGoal: number;
  fight: number;
  blockedShot: number;
  hit: number;
  win: number;
  shutout: number;
  save: number;
  goalieAssist: number;
  goalieGoal: number;
  goalieFight: number;
}
