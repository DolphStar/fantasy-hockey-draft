// NHL API with Vercel proxy to avoid CORS issues
// Local development: Vite proxy (/v1 → https://api-web.nhle.com)
// Production: Vercel rewrites (/api/web → https://api-web.nhle.com)
// API Documentation: https://github.com/Zmalski/NHL-API-Reference

// Use different base URL for dev and production
// In production (Vercel), use the proxy endpoint
// In development, use Vite's proxy
const BASE_URL_WEB = import.meta.env.PROD ? '/api/web/v1' : '/v1';

// Compute the current NHL season ID (e.g. 20252026)
// Season starts in September and runs through the following year
function getCurrentSeasonId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  const startYear = month >= 9 ? year : year - 1;
  const endYear = startYear + 1;

  return `${startYear}${endYear}`;
}

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
  try {
    const seasonId = getCurrentSeasonId();
    const response = await fetch(`${BASE_URL_WEB}/roster/${teamAbbrev}/${seasonId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch roster for ${teamAbbrev}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`NHL API Response for ${teamAbbrev}:`, data);
    
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
      forwards: data.forwards,
      defensemen: data.defensemen,
      goalies: data.goalies
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
