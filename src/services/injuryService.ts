// NHL API for injury/roster status
// Uses NHL's official web API to check player status

export interface InjuryReport {
  playerId: number;
  playerName: string;
  team: string;
  teamAbbrev: string;
  position: string;
  status: string; // e.g., "Out", "Day-To-Day", "IR", "Injured"
  injuryType: string; // e.g., "Upper Body", "Lower Body", "Illness"
  description: string;
  returnDate?: string;
  lastUpdated: string;
}

// NHL API base URL
const NHL_API_BASE = 'https://api-web.nhle.com/v1';

// NHL team abbreviations
const NHL_TEAM_ABBREVS = [
  'ANA', 'BOS', 'BUF', 'CAR', 'CBJ', 'CGY', 'CHI', 'COL', 'DAL', 'DET',
  'EDM', 'FLA', 'LAK', 'MIN', 'MTL', 'NJD', 'NSH', 'NYI', 'NYR', 'OTT',
  'PHI', 'PIT', 'SEA', 'SJS', 'STL', 'TBL', 'TOR', 'VAN', 'VGK', 'WPG', 'WSH', 'ARI'
];

/**
 * Fetch injuries for all NHL teams
 * 
 * NOTE: Free injury data is not reliably available from any API.
 * Options for production:
 * 1. Pay for Sportradar API ($500+/month) - https://developer.sportradar.com/
 * 2. Scrape from NHL.com (fragile, against ToS)
 * 3. Manually maintain an injury list in Firestore (admin can update)
 * 
 * For now, returns empty array - injury feature is disabled pending data source.
 */
export async function fetchAllInjuries(): Promise<InjuryReport[]> {
  // Return empty for now - no free API available
  console.warn('⚠️ Injury data unavailable: No free NHL injury API exists');
  console.log('Consider Sportradar API (paid) or manual injury tracking');
  return [];
  
  // Keeping the original code structure for future implementation
  /*
  const allInjuries: InjuryReport[] = [];
  
  try {
    // Fetch all teams' rosters in parallel
    const promises = NHL_TEAM_ABBREVS.map(teamAbbrev => fetchTeamInjuries(teamAbbrev));
    
    const results = await Promise.allSettled(promises);
    
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allInjuries.push(...result.value);
      }
    });
    
    console.log(`Fetched ${allInjuries.length} injuries from NHL API`);
    return allInjuries;
  } catch (error) {
    console.error('Error fetching all injuries:', error);
    return [];
  }
  */
}

/**
 * Fetch injuries for a specific team using NHL roster API
 */
async function fetchTeamInjuries(teamAbbrev: string): Promise<InjuryReport[]> {
  try {
    // Use NHL's roster endpoint which includes player status
    const response = await fetch(`${NHL_API_BASE}/roster/${teamAbbrev}/current`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: any = await response.json();
    const injuries: InjuryReport[] = [];
    
    // Check forwards, defensemen, and goalies
    const allPlayers = [
      ...(data.forwards || []),
      ...(data.defensemen || []),
      ...(data.goalies || [])
    ];
    
    for (const player of allPlayers) {
      // NHL API doesn't always have injury data directly
      // We'll create a simple mock for now - you may need to scrape from NHL.com
      // or use a paid API for detailed injury info
      
      // For now, return empty array - we need a different approach
      // This is a limitation of free NHL APIs
    }
    
    return injuries;
  } catch (error) {
    console.warn(`Failed to fetch injuries for team ${teamAbbrev}:`, error);
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
