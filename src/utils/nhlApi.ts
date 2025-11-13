// Using Vite proxy to avoid CORS issues
// Requests to /v1 will be proxied to https://api-web.nhle.com
// API Documentation: https://github.com/Zmalski/NHL-API-Reference

// NOTE: NHL API has strict CORS policies that block browser requests
// For production, you'll need a backend server to proxy requests
// For now, using mock data for development
const USE_MOCK_DATA = true;

export interface RosterPlayer {
  id: number;
  headshot: string;
  firstName: {
    default: string;
  };
  lastName: {
    default: string;
  };
  sweaterNumber: number;
  positionCode: string;
  shootsCatches?: string;
  heightInInches?: number;
  weightInPounds?: number;
}

export interface RosterPerson {
  person: RosterPlayer;
  jerseyNumber: string;
  position: {
    code: string;
    name: string;
  };
}

export interface TeamRoster {
  roster: RosterPerson[];
  forwards?: RosterPlayer[];
  defensemen?: RosterPlayer[];
  goalies?: RosterPlayer[];
}

/**
 * Fetch the current roster for a specific NHL team
 * @param teamAbbrev - Three-letter team abbreviation (e.g., 'VAN', 'TOR', 'EDM')
 * @returns Promise with the team's roster data
 */
export async function getTeamRoster(teamAbbrev: string): Promise<TeamRoster> {
  // Use mock data due to NHL API CORS restrictions
  if (USE_MOCK_DATA) {
    const { getMockRoster } = await import('./mockNhlData');
    const mockData = getMockRoster(teamAbbrev);
    
    if (!mockData) {
      throw new Error(`Mock data not available for ${teamAbbrev}.`);
    }
    
    console.log(`Using mock data for ${teamAbbrev}:`, mockData);
    
    // Convert to our roster format
    const allPlayers = [
      ...(mockData.forwards || []),
      ...(mockData.defensemen || []),
      ...(mockData.goalies || [])
    ];
    
    return {
      forwards: mockData.forwards,
      defensemen: mockData.defensemen,
      goalies: mockData.goalies,
      roster: allPlayers.map((p: RosterPlayer) => ({
        person: p,
        jerseyNumber: String(p.sweaterNumber),
        position: {
          code: p.positionCode,
          name: getPositionName(p.positionCode)
        }
      }))
    };
  }

  // Real API call (currently blocked by CORS)
  try {
    const response = await fetch(`/v1/roster/${teamAbbrev}/current`);

    if (!response.ok) {
      throw new Error(`Failed to fetch roster: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('API Response:', data);
    
    const allPlayers = [
      ...(data.forwards || []),
      ...(data.defensemen || []),
      ...(data.goalies || [])
    ];
    
    return {
      roster: allPlayers.map((p: RosterPlayer) => ({
        person: p,
        jerseyNumber: String(p.sweaterNumber),
        position: {
          code: p.positionCode,
          name: getPositionName(p.positionCode)
        }
      })),
      ...data
    };
  } catch (error) {
    console.error(`Error fetching roster for ${teamAbbrev}:`, error);
    throw error;
  }
}

function getPositionName(code: string): string {
  const positions: Record<string, string> = {
    'C': 'Center',
    'L': 'Left Wing',
    'R': 'Right Wing',
    'D': 'Defenseman',
    'G': 'Goalie'
  };
  return positions[code] || code;
}

/**
 * Get all players from a roster
 * @param roster - TeamRoster object
 * @returns Array of all RosterPerson objects
 */
export function getAllPlayers(roster: TeamRoster): RosterPerson[] {
  return roster.roster;
}

/**
 * Get player full name
 * @param rosterPerson - RosterPerson object
 * @returns Full name string
 */
export function getPlayerFullName(rosterPerson: RosterPerson): string {
  const player = rosterPerson.person;
  return `${player.firstName.default} ${player.lastName.default}`;
}

// Team abbreviations reference
export const NHL_TEAMS = {
  ANA: 'Anaheim Ducks',
  BOS: 'Boston Bruins',
  BUF: 'Buffalo Sabres',
  CAR: 'Carolina Hurricanes',
  CBJ: 'Columbus Blue Jackets',
  CGY: 'Calgary Flames',
  CHI: 'Chicago Blackhawks',
  COL: 'Colorado Avalanche',
  DAL: 'Dallas Stars',
  DET: 'Detroit Red Wings',
  EDM: 'Edmonton Oilers',
  FLA: 'Florida Panthers',
  LAK: 'Los Angeles Kings',
  MIN: 'Minnesota Wild',
  MTL: 'Montreal Canadiens',
  NJD: 'New Jersey Devils',
  NSH: 'Nashville Predators',
  NYI: 'New York Islanders',
  NYR: 'New York Rangers',
  OTT: 'Ottawa Senators',
  PHI: 'Philadelphia Flyers',
  PIT: 'Pittsburgh Penguins',
  SEA: 'Seattle Kraken',
  SJS: 'San Jose Sharks',
  STL: 'St. Louis Blues',
  TBL: 'Tampa Bay Lightning',
  TOR: 'Toronto Maple Leafs',
  UTA: 'Utah Hockey Club',
  VAN: 'Vancouver Canucks',
  VGK: 'Vegas Golden Knights',
  WPG: 'Winnipeg Jets',
  WSH: 'Washington Capitals',
} as const;

export type TeamAbbrev = keyof typeof NHL_TEAMS;
