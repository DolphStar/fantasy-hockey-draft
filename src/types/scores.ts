/** Team score totals stored at leagues/{leagueId}/teamScores/{teamName}. */
export interface TeamScore {
  teamName: string;
  totalPoints: number;
  wins: number;
  losses: number;
  lastUpdated: string;
}
