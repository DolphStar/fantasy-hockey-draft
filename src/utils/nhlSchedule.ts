// Fetch and parse NHL schedule for upcoming matchups

interface Game {
  id: number;
  startTimeUTC: string;
  awayTeam: { abbrev: string; placeName: { default: string }; score?: number };
  homeTeam: { abbrev: string; placeName: { default: string }; score?: number };
  gameState: string;
}

interface ScheduleDay {
  date: string;
  games: Game[];
}

interface ScheduleResponse {
  gameWeek: ScheduleDay[];
}

export interface PlayerMatchup {
  playerId: number;
  playerName: string;
  teamAbbrev: string;
  opponent: string;
  isHome: boolean;
  gameTime: string;
  gameTimeUTC: string;
  gameState: string;
  gameId: number;
  awayScore?: number;
  homeScore?: number;
}

/**
 * Fetch today's NHL schedule
 */
export async function fetchTodaySchedule(): Promise<Game[]> {
  try {
    // Use our serverless function to avoid CORS issues
    const response = await fetch('/api/nhl-schedule');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data: ScheduleResponse = await response.json();
    
    // Get today's date in Eastern Time (NHL's timezone)
    const today = new Date().toLocaleDateString('en-CA', { 
      timeZone: 'America/New_York' 
    });
    
    // Find today's games
    const todaySchedule = data.gameWeek.find(day => day.date === today);
    
    return todaySchedule?.games || [];
  } catch (error) {
    console.error('Error fetching NHL schedule:', error);
    return [];
  }
}

/**
 * Get upcoming matchups for user's roster
 */
export function getUpcomingMatchups(
  roster: Array<{ playerId: number; name: string; nhlTeam: string }>,
  todaysGames: Game[]
): PlayerMatchup[] {
  if (todaysGames.length === 0) return [];

  const matchups = roster
    .map(player => {
      // Find a game where this player's team is either home or away
      const game = todaysGames.find(
        g => 
          g.awayTeam.abbrev === player.nhlTeam || 
          g.homeTeam.abbrev === player.nhlTeam
      );

      if (!game) return null; // Player has no game today

      // Determine if home or away
      const isHome = game.homeTeam.abbrev === player.nhlTeam;
      const opponent = isHome ? game.awayTeam.abbrev : game.homeTeam.abbrev;
      
      // Convert UTC time to local time
      const gameDate = new Date(game.startTimeUTC);
      const gameTime = gameDate.toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      });

      return {
        playerId: player.playerId,
        playerName: player.name,
        teamAbbrev: player.nhlTeam,
        opponent,
        isHome,
        gameTime,
        gameTimeUTC: game.startTimeUTC,
        gameState: game.gameState,
        gameId: game.id,
        awayScore: game.awayTeam.score,
        homeScore: game.homeTeam.score
      };
    })
    .filter(m => m !== null) as PlayerMatchup[];

  // Sort by game time
  matchups.sort((a, b) => 
    new Date(a.gameTimeUTC).getTime() - new Date(b.gameTimeUTC).getTime()
  );

  return matchups;
}
