export interface PlayerGameStats {
  playerId: number;
  name: {
    default: string;
  };
  teamAbbrev?: string;
  position: string;
  sweaterNumber?: number;
  goals?: number;
  assists?: number;
  points?: number;
  plusMinus?: number;
  powerPlayGoals?: number;
  shortHandedGoals?: number;
  /** Derived: OT goals counted from the landing goal summary (not in the boxscore). */
  overtimeGoals?: number;
  shots?: number;
  /** Shots on goal as returned by the boxscore API (the API has no `shots` field). */
  sog?: number;
  hits?: number;
  blockedShots?: number;
  pim?: number;
  fights?: number;
  faceoffWinningPctg?: number;
  toi?: string;
  wins?: number;
  losses?: number;
  otLosses?: number;
  /** Goalie decision from the boxscore: 'W' | 'L' | 'O'; absent when not charged with one. */
  decision?: string;
  saves?: number;
  goalsAgainst?: number;
  shutouts?: number;
  savePctg?: number;
}
