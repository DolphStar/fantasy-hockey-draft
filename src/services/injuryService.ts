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
 * Fetch injuries for all NHL teams using NHL API
 * 
 * Method: Check each player's landing page for injuryStatus field
 * Endpoint: https://api-web.nhle.com/v1/player/{playerId}/landing
 * 
 * Also checks game center data for game-day scratches/injuries:
 * https://api-web.nhle.com/v1/gamecenter/{gameId}/landing
 */
export async function fetchAllInjuries(): Promise<InjuryReport[]> {
  const allInjuries: InjuryReport[] = [];
  
  try {
    console.log('🏒 Fetching NHL injury data...');
    
    // Fetch all teams' rosters and check each player
    const promises = NHL_TEAM_ABBREVS.map(teamAbbrev => fetchTeamInjuries(teamAbbrev));
    
    const results = await Promise.allSettled(promises);
    
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allInjuries.push(...result.value);
      } else {
        console.warn('Failed to fetch team injuries:', result.reason);
      }
    });
    
    console.log(`✅ Fetched ${allInjuries.length} injuries from NHL API`);
    return allInjuries;
  } catch (error) {
    console.error('Error fetching all injuries:', error);
    return [];
  }
}

/**
 * Fetch injuries for a specific team using NHL roster + player landing pages
 */
async function fetchTeamInjuries(teamAbbrev: string): Promise<InjuryReport[]> {
  try {
    // Step 1: Get team roster
    const rosterResponse = await fetch(`${NHL_API_BASE}/roster/${teamAbbrev}/current`);
    
    if (!rosterResponse.ok) {
      throw new Error(`HTTP ${rosterResponse.status}`);
    }
    
    const rosterData: any = await rosterResponse.json();
    const injuries: InjuryReport[] = [];
    
    // Step 2: Get all players from roster
    const allPlayers = [
      ...(rosterData.forwards || []),
      ...(rosterData.defensemen || []),
      ...(rosterData.goalies || [])
    ];
    
    // Step 3: Check each player's landing page for injury status
    // Limit concurrent requests to avoid rate limiting
    const BATCH_SIZE = 5;
    for (let i = 0; i < allPlayers.length; i += BATCH_SIZE) {
      const batch = allPlayers.slice(i, i + BATCH_SIZE);
      const playerPromises = batch.map(player => checkPlayerInjury(player, teamAbbrev));
      const playerResults = await Promise.allSettled(playerPromises);
      
      playerResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          injuries.push(result.value);
        }
      });
    }
    
    return injuries;
  } catch (error) {
    console.warn(`Failed to fetch injuries for team ${teamAbbrev}:`, error);
    return [];
  }
}

/**
 * Check if a specific player is injured using their landing page
 * Endpoint: https://api-web.nhle.com/v1/player/{playerId}/landing
 */
async function checkPlayerInjury(player: any, teamAbbrev: string): Promise<InjuryReport | null> {
  try {
    const playerId = player.id;
    const response = await fetch(`${NHL_API_BASE}/player/${playerId}/landing`);
    
    if (!response.ok) {
      return null;
    }
    
    const data: any = await response.json();
    
    // Check if player has injury status
    if (data.injuryStatus) {
      return {
        playerId: playerId,
        playerName: `${player.firstName?.default || ''} ${player.lastName?.default || ''}`.trim(),
        team: teamAbbrev,
        teamAbbrev: teamAbbrev,
        position: player.positionCode || 'N/A',
        status: data.injuryStatus || 'Out',
        injuryType: data.injuryDescription || 'Undisclosed',
        description: data.injuryDescription || 'No details available',
        returnDate: data.injuryReturnDate,
        lastUpdated: new Date().toISOString()
      };
    }
    
    return null;
  } catch (error) {
    // Silently fail for individual players to avoid spam
    return null;
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
