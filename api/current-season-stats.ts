import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function to fetch LAST 7 DAYS NHL Stats
 * Used for Waiver Wire / Hot Pickups feature
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS for our frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Calculate date range for last 7 days
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const startDate = formatDate(sevenDaysAgo);
    const endDate = formatDate(today);

    // Fetch games from last 7 days
    const scheduleRes = await fetch(
      `https://api-web.nhle.com/v1/schedule/${startDate}`
    );
    
    if (!scheduleRes.ok) {
      throw new Error(`Schedule API error: ${scheduleRes.status}`);
    }
    
    const scheduleData = await scheduleRes.json();
    
    // Collect all game IDs from the schedule (includes multiple days)
    const gameIds: number[] = [];
    
    // The schedule endpoint returns a week of games
    if (scheduleData.gameWeek) {
      for (const day of scheduleData.gameWeek) {
        if (day.games) {
          for (const game of day.games) {
            if (game.gameState === 'OFF' || game.gameState === 'FINAL') {
              gameIds.push(game.id);
            }
          }
        }
      }
    }
    
    // Fetch boxscores for each game and aggregate player stats
    const playerStats = new Map<number, {
      playerId: number;
      name: string;
      team: string;
      position: string;
      goals: number;
      assists: number;
      points: number;
      wins: number;
      gamesPlayed: number;
    }>();
    
    // Limit to last 20 games to avoid too many API calls
    const gamesToFetch = gameIds.slice(0, 20);
    
    for (const gameId of gamesToFetch) {
      try {
        const boxscoreRes = await fetch(
          `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`
        );
        
        if (!boxscoreRes.ok) continue;
        
        const boxscore = await boxscoreRes.json();
        
        // Process both teams
        for (const teamKey of ['homeTeam', 'awayTeam']) {
          const team = boxscore[teamKey];
          if (!team) continue;
          
          const teamAbbrev = team.abbrev || 'UNK';
          
          // Process forwards and defense
          for (const posGroup of ['forwards', 'defense']) {
            const players = team.playerByGameStats?.[posGroup] || [];
            for (const player of players) {
              const id = player.playerId;
              if (!playerStats.has(id)) {
                playerStats.set(id, {
                  playerId: id,
                  name: player.name?.default || 'Unknown',
                  team: teamAbbrev,
                  position: player.position || 'F',
                  goals: 0,
                  assists: 0,
                  points: 0,
                  wins: 0,
                  gamesPlayed: 0
                });
              }
              const stats = playerStats.get(id)!;
              stats.goals += player.goals || 0;
              stats.assists += player.assists || 0;
              stats.points += (player.goals || 0) + (player.assists || 0);
              stats.gamesPlayed += 1;
            }
          }
          
          // Process goalies
          const goalies = team.playerByGameStats?.goalies || [];
          for (const goalie of goalies) {
            const id = goalie.playerId;
            if (!playerStats.has(id)) {
              playerStats.set(id, {
                playerId: id,
                name: goalie.name?.default || 'Unknown',
                team: teamAbbrev,
                position: 'G',
                goals: 0,
                assists: 0,
                points: 0,
                wins: 0,
                gamesPlayed: 0
              });
            }
            const stats = playerStats.get(id)!;
            // Check if goalie got the win (decision === 'W')
            if (goalie.decision === 'W') {
              stats.wins += 1;
              stats.points += 2; // 2 pts per win for goalies
            }
            stats.gamesPlayed += 1;
          }
        }
      } catch (e) {
        console.error(`Error fetching game ${gameId}:`, e);
      }
    }
    
    // Convert to array and sort by points
    const players = Array.from(playerStats.values())
      .filter(p => p.points > 0)
      .sort((a, b) => b.points - a.points);

    return res.status(200).json({
      players,
      gamesProcessed: gamesToFetch.length,
      dateRange: { startDate, endDate }
    });

  } catch (error) {
    console.error('Error fetching weekly stats:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
