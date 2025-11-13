// League types and interfaces

export type LeagueStatus = 'pending' | 'live' | 'complete';

export interface LeagueTeam {
  teamName: string;
  ownerUid: string;
  ownerEmail?: string; // Optional: to help identify users
}

// Scoring rules for fantasy points
export interface ScoringRules {
  // Skater scoring
  goal: number;
  assist: number;
  shortHandedGoal: number;
  overtimeGoal: number;
  fight: number;
  
  // Defense-specific scoring
  blockedShot: number;
  hit: number;
  
  // Goalie scoring
  win: number;
  shutout: number;
  save: number;
  goalieAssist: number;
  goalieGoal: number;
  goalieFight: number;
}

// Roster requirements
export interface RosterSettings {
  forwards: number;  // F
  defensemen: number; // D
  goalies: number;   // G
  reserves: number;  // Bench (any position)
}

export interface League {
  id: string;
  leagueName: string;
  admin: string; // Firebase Auth UID of the admin
  status: LeagueStatus;
  teams: LeagueTeam[];
  draftRounds: number;
  scoringRules: ScoringRules;
  rosterSettings: RosterSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeagueData {
  leagueName: string;
  teams: LeagueTeam[];
  draftRounds?: number;
}
