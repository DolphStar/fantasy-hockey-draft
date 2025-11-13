// League types and interfaces

export type LeagueStatus = 'pending' | 'live' | 'complete';

export interface LeagueTeam {
  teamName: string;
  ownerUid: string;
  ownerEmail?: string; // Optional: to help identify users
}

export interface League {
  id: string;
  leagueName: string;
  admin: string; // Firebase Auth UID of the admin
  status: LeagueStatus;
  teams: LeagueTeam[];
  draftRounds: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeagueData {
  leagueName: string;
  teams: LeagueTeam[];
  draftRounds?: number;
}
