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
  awards?: SeasonAwards;
  stats?: SeasonStats;
  teamSummaries?: TeamSummary[];
}

export interface AwardPlayer {
  playerId: number;
  name: string;
  position: string;
  nhlTeam: string;
  points: number;
  draftedByTeam: string;
}

export interface SeasonAwards {
  mvp: AwardPlayer | null;
  bestSteal: AwardPlayer | null;
  biggestBust: AwardPlayer | null;
  topGoalie: AwardPlayer | null;
  biggestNight: { playerId: number; name: string; draftedByTeam: string; date: string; points: number } | null;
}

export interface SeasonStats {
  totalPoints: number;
  avgTeamPoints: number;
  runnerUpGap: number;
}

export interface TeamSummary {
  teamName: string;
  ownerUid: string;
  rank: number;
  totalPoints: number;
  topPlayer: { name: string; points: number } | null;
  bestPick: { name: string; round: number; points: number } | null;
}
