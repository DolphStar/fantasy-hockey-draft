export interface ScoringRules {
  goal: number;
  assist: number;
  shortHandedGoal: number;
  // Kept in the shared config shape for compatibility even though the current
  // NHL boxscore player stats do not expose a separate overtime-goal field.
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
