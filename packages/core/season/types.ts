export interface SeasonArchive {
  seasonId: string;            // '2025-26'
  endedAt: string;             // ISO timestamp
  endedBy: 'admin' | 'auto';
  champion: { teamName: string; ownerUid: string; totalPoints: number };
  standings: Array<{ rank: number; teamName: string; ownerUid: string; totalPoints: number }>;
  topPlayers: Array<{
    playerId: number;
    name: string;
    position: string;
    nhlTeam: string;
    points: number;
    draftedByTeam: string;
  }>;
  teamCount: number;
}
