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
  shots?: number;
  hits?: number;
  blockedShots?: number;
  pim?: number;
  fights?: number;
  faceoffWinningPctg?: number;
  toi?: string;
  wins?: number;
  losses?: number;
  otLosses?: number;
  saves?: number;
  goalsAgainst?: number;
  shutouts?: number;
  savePctg?: number;
}
