// ESPN's hidden API for NHL injuries
// This uses ESPN's undocumented API - may break if they change structure

export interface InjuryReport {
  playerId: number;
  playerName: string;
  team: string;
  teamAbbrev: string;
  position: string;
  status: string; // e.g., "Out", "Day-To-Day", "Questionable", "Doubtful"
  injuryType: string; // e.g., "Upper Body", "Lower Body", "Concussion", etc.
  description: string;
  returnDate?: string;
  lastUpdated: string;
}

interface ESPNTeamResponse {
  team: {
    id: string;
    abbreviation: string;
    displayName: string;
    athletes?: Array<{
      id: string;
      displayName: string;
      position: { abbreviation: string };
      injuries?: Array<{
        status: string;
        type?: string;
        details?: {
          type?: string;
          detail?: string;
          fantasyStatus?: string;
        };
        date?: string;
      }>;
    }>;
  };
}

const ESPN_NHL_TEAMS_API = 'http://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams';

// NHL team IDs from ESPN (team ID to abbreviation mapping)
const ESPN_TEAM_IDS: Record<string, string> = {
  '1': 'NJD', '2': 'NYI', '3': 'NYR', '4': 'PHI', '5': 'PIT',
  '6': 'BOS', '7': 'BUF', '8': 'MTL', '9': 'OTT', '10': 'TOR',
  '12': 'CAR', '13': 'FLA', '14': 'TBL', '15': 'WSH', '16': 'CHI',
  '17': 'DET', '18': 'NSH', '19': 'STL', '20': 'CGY', '21': 'COL',
  '22': 'EDM', '23': 'VAN', '24': 'ANA', '25': 'DAL', '26': 'LAK',
  '28': 'SJS', '29': 'CBJ', '30': 'MIN', '52': 'WPG', '53': 'ARI',
  '54': 'VGK', '55': 'SEA'
};

/**
 * Fetch injuries for all NHL teams from ESPN's hidden API
 */
export async function fetchAllInjuries(): Promise<InjuryReport[]> {
  const allInjuries: InjuryReport[] = [];
  
  try {
    // Fetch all teams in parallel
    const teamIds = Object.keys(ESPN_TEAM_IDS);
    const promises = teamIds.map(teamId => fetchTeamInjuries(teamId));
    
    const results = await Promise.allSettled(promises);
    
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allInjuries.push(...result.value);
      }
    });
    
    console.log(`Fetched ${allInjuries.length} injuries from ESPN API`);
    return allInjuries;
  } catch (error) {
    console.error('Error fetching all injuries:', error);
    return [];
  }
}

/**
 * Fetch injuries for a specific team
 */
async function fetchTeamInjuries(teamId: string): Promise<InjuryReport[]> {
  try {
    const response = await fetch(`${ESPN_NHL_TEAMS_API}/${teamId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: ESPNTeamResponse = await response.json();
    const injuries: InjuryReport[] = [];
    
    if (!data.team?.athletes) {
      return injuries;
    }
    
    for (const athlete of data.team.athletes) {
      if (athlete.injuries && athlete.injuries.length > 0) {
        const latestInjury = athlete.injuries[0]; // Most recent injury
        
        injuries.push({
          playerId: parseInt(athlete.id),
          playerName: athlete.displayName,
          team: data.team.displayName,
          teamAbbrev: data.team.abbreviation || ESPN_TEAM_IDS[teamId] || 'UNK',
          position: athlete.position?.abbreviation || 'N/A',
          status: latestInjury.status || 'Out',
          injuryType: latestInjury.details?.type || latestInjury.type || 'Undisclosed',
          description: latestInjury.details?.detail || latestInjury.details?.fantasyStatus || 'No details available',
          returnDate: latestInjury.date,
          lastUpdated: new Date().toISOString()
        });
      }
    }
    
    return injuries;
  } catch (error) {
    console.warn(`Failed to fetch injuries for team ${teamId}:`, error);
    return [];
  }
}

/**
 * Check if a specific player is injured
 */
export function isPlayerInjured(playerId: number, injuries: InjuryReport[]): InjuryReport | null {
  return injuries.find(injury => injury.playerId === playerId) || null;
}

/**
 * Get injury status emoji
 */
export function getInjuryIcon(status: string): string {
  switch (status.toLowerCase()) {
    case 'out':
    case 'injured reserve':
    case 'ir':
      return '🚑';
    case 'day-to-day':
    case 'day to day':
    case 'dtd':
      return '⚕️';
    case 'questionable':
      return '❓';
    case 'doubtful':
      return '❌';
    default:
      return '⚕️';
  }
}

/**
 * Get injury status color
 */
export function getInjuryColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'out':
    case 'injured reserve':
    case 'ir':
      return 'bg-red-600';
    case 'day-to-day':
    case 'day to day':
    case 'dtd':
      return 'bg-yellow-600';
    case 'questionable':
      return 'bg-orange-600';
    case 'doubtful':
      return 'bg-red-500';
    default:
      return 'bg-gray-600';
  }
}
