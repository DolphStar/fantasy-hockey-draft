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

// NHL game types
export const NHL_GAME_TYPES = {
  PRESEASON: 1,
  REGULAR_SEASON: 2,
  PLAYOFFS: 3,
  ALL_STAR: 4,
} as const;

export type NHLGameType = (typeof NHL_GAME_TYPES)[keyof typeof NHL_GAME_TYPES];

export interface League {
  id: string;
  leagueName: string;
  admin: string; // Firebase Auth UID of the admin
  status: LeagueStatus;
  teams: LeagueTeam[];
  memberUids: string[]; // Flat array of team owner UIDs for Firestore security rules
  draftRounds: number;
  scoringRules: ScoringRules;
  rosterSettings: RosterSettings;
  allowedGameTypes: number[]; // NHL gameType values: 2=Regular Season, 3=Playoffs
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeagueData {
  leagueName: string;
  teams: LeagueTeam[];
  draftRounds?: number;
  allowedGameTypes?: number[];
}
