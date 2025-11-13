// NHL Stats API utilities for fetching game data and player stats
// Uses the same proxy configuration as nhlApi.ts

const BASE_URL_WEB = import.meta.env.PROD ? '/api/web/v1' : '/v1';

export interface GameScore {
  id: number;
  season: number;
  gameType: number;
  gameDate: string;
  awayTeam: {
    id: number;
    abbrev: string;
    score: number;
  };
  homeTeam: {
    id: number;
    abbrev: string;
    score: number;
  };
  gameState: string;
  gameOutcome: {
    lastPeriodType: string;
  };
}

export interface PlayerGameStats {
  playerId: number;
  name: {
    default: string; // NHL API returns name as object with 'default' property
  };
  teamAbbrev?: string;
  position: string;
  sweaterNumber?: number;
  goals?: number;
  assists?: number;
  points?: number;
  plusMinus?: number;
  powerPlayGoals?: number;
  shortHandedGoals?: number;
  shots?: number;
  hits?: number;
  blockedShots?: number;
  pim?: number; // Penalty minutes
  faceoffWinningPctg?: number;
  toi?: string; // Time on ice
  // Goalie stats
  wins?: number;
  losses?: number;
  otLosses?: number;
  saves?: number;
  goalsAgainst?: number;
  shutouts?: number;
  savePctg?: number;
}

export interface Boxscore {
  gameId: number;
  awayTeam?: {
    abbrev?: string;
  };
  homeTeam?: {
    abbrev?: string;
  };
  playerByGameStats: {
    awayTeam: {
      forwards: PlayerGameStats[];
      defense: PlayerGameStats[];
      goalies: PlayerGameStats[];
    };
    homeTeam: {
      forwards: PlayerGameStats[];
      defense: PlayerGameStats[];
      goalies: PlayerGameStats[];
    };
  };
}

/**
 * Fetch all games for a specific date
 * @param date - Date in YYYY-MM-DD format (defaults to yesterday)
 * @returns Promise with array of games
 */
export async function getGamesForDate(date?: string): Promise<GameScore[]> {
  try {
    // Default to yesterday's date
    if (!date) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      date = yesterday.toISOString().split('T')[0];
    }
    
    const response = await fetch(`${BASE_URL_WEB}/score/${date}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch games for ${date}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`NHL Stats: Found ${data.games?.length || 0} games for ${date}`);
    
    return data.games || [];
  } catch (error) {
    console.error('Error fetching games:', error);
    throw error;
  }
}

/**
 * Fetch boxscore (player stats) for a specific game
 * @param gameId - NHL game ID
 * @returns Promise with boxscore data
 */
export async function getGameBoxscore(gameId: number): Promise<Boxscore> {
  try {
    const response = await fetch(`${BASE_URL_WEB}/gamecenter/${gameId}/boxscore`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch boxscore for game ${gameId}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`NHL Stats: Fetched boxscore for game ${gameId}`);
    
    // DEBUG: Log sample player structure
    if (data.playerByGameStats?.awayTeam?.forwards?.[0]) {
      console.log('DEBUG: Raw player object from API:', data.playerByGameStats.awayTeam.forwards[0]);
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching boxscore for game ${gameId}:`, error);
    throw error;
  }
}

/**
 * Get all completed games from yesterday
 * @returns Promise with array of completed game IDs
 */
export async function getCompletedGamesYesterday(): Promise<number[]> {
  try {
    const games = await getGamesForDate();
    
    // Filter for completed games only (Final or Overtime)
    const completedGames = games.filter(
      game => game.gameState === 'OFF' || game.gameState === 'FINAL'
    );
    
    console.log(`NHL Stats: ${completedGames.length} completed games yesterday`);
    
    return completedGames.map(game => game.id);
  } catch (error) {
    console.error('Error getting completed games:', error);
    throw error;
  }
}

/**
 * Get all player stats from a boxscore
 * @param boxscore - Boxscore data from API
 * @returns Array of all player stats from both teams
 */
export function getAllPlayersFromBoxscore(boxscore: Boxscore): PlayerGameStats[] {
  const players: PlayerGameStats[] = [];
  
  if (!boxscore.playerByGameStats) {
    return players;
  }
  
  const { awayTeam, homeTeam } = boxscore.playerByGameStats;
  const awayTeamAbbrev = boxscore.awayTeam?.abbrev || 'UNK';
  const homeTeamAbbrev = boxscore.homeTeam?.abbrev || 'UNK';
  
  // Collect all away team players and add team abbreviation
  if (awayTeam) {
    const awayPlayers = [
      ...(awayTeam.forwards || []),
      ...(awayTeam.defense || []),
      ...(awayTeam.goalies || [])
    ];
    awayPlayers.forEach(player => {
      player.teamAbbrev = awayTeamAbbrev;
    });
    players.push(...awayPlayers);
  }
  
  // Collect all home team players and add team abbreviation
  if (homeTeam) {
    const homePlayers = [
      ...(homeTeam.forwards || []),
      ...(homeTeam.defense || []),
      ...(homeTeam.goalies || [])
    ];
    homePlayers.forEach(player => {
      player.teamAbbrev = homeTeamAbbrev;
    });
    players.push(...homePlayers);
  }
  
  return players;
}
