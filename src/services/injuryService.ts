// ESPN Injuries API - The best free source for NHL injury data!
// Single endpoint returns ALL NHL injuries in one request

export interface InjuryReport {
  playerId: number;
  playerName: string;
  team: string;
  teamAbbrev: string;
  position: string;
  status: string; // e.g., "Out", "Day-To-Day", "Questionable", "Doubtful"
  injuryType: string; // e.g., "Upper Body", "Lower Body", "Illness"
  description: string;
  returnDate?: string;
  lastUpdated: string;
}

// ESPN's injury API endpoint - returns all NHL injuries in ONE request!
const ESPN_INJURIES_API = 'https://site.web.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries';

/**
 * Fetch ALL NHL injuries from ESPN's injury API
 * 
 * This is the BEST method - one API call gets all injuries!
 * Endpoint: https://site.web.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries
 * 
 * Returns injuries sorted by team with:
 * - Player name, position, team
 * - Status: "Out", "Day-To-Day", "Questionable", "Doubtful", "IR"
 * - Injury type: "Upper Body", "Lower Body", etc.
 * - Description and return date
 */
export async function fetchAllInjuries(): Promise<InjuryReport[]> {
  const allInjuries: InjuryReport[] = [];
  
  try {
    console.log('🏒 Fetching NHL injury data from ESPN...');
    
    const response = await fetch(ESPN_INJURIES_API);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: any = await response.json();
    
    // ESPN returns injuries grouped by team
    if (data.injuries && Array.isArray(data.injuries)) {
      for (const teamData of data.injuries) {
        const teamAbbrev = teamData.id || 'UNK'; // Team ID (e.g., "25" for ANA)
        const teamName = teamData.displayName || 'Unknown';
        
        // Each team has an injuries array
        if (teamData.injuries && Array.isArray(teamData.injuries)) {
          for (const injury of teamData.injuries) {
            const athlete = injury.athlete || {};
            const details = injury.details || {};
            
            allInjuries.push({
              playerId: parseInt(athlete.id) || 0,
              playerName: athlete.displayName || 'Unknown Player',
              team: teamName,
              teamAbbrev: athlete.team?.abbreviation || teamAbbrev,
              position: athlete.position?.abbreviation || 'N/A',
              status: injury.status || 'Out',
              injuryType: details.type || 'Undisclosed',
              description: injury.longComment || injury.shortComment || details.type || 'No details available',
              returnDate: details.returnDate,
              lastUpdated: new Date().toISOString()
            });
          }
        }
      }
    }
    
    console.log(`✅ Fetched ${allInjuries.length} injuries from ESPN API`);
    return allInjuries;
  } catch (error) {
    console.error('Error fetching injuries from ESPN:', error);
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
