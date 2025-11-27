import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function to fetch LAST 7 DAYS NHL Stats
 * Used for Waiver Wire / Hot Pickups feature
 * Fetches recent games and aggregates player performance
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
    
    // Fetch schedule
    const scheduleRes = await fetch(
      `https://api-web.nhle.com/v1/schedule/${startDate}`
    );
    
    if (!scheduleRes.ok) {
      throw new Error(`Schedule API error: ${scheduleRes.status}`);
    }
    
    const scheduleData = await scheduleRes.json();
    const gameIds: number[] = [];
    
    // Collect game IDs (only completed games)
    if (scheduleData.gameWeek) {
      for (const day of scheduleData.gameWeek) {
        if (day.games) {
          for (const game of day.games) {
            // Only process games that are FINAL or OFF (official)
            if (game.gameState === 'OFF' || game.gameState === 'FINAL') {
              gameIds.push(game.id);
            }
          }
        }
      }
    }

    // Limit to last 25 games to prevent timeouts if week is busy
    const gamesToProcess = gameIds.slice(-25); 
    
    // Aggregation map
    const playerStats = new Map<number, {
      playerId: number;
      name: string;
      team: string;
      position: string;
      goals: number;
      assists: number;
      wins: number;
      points: number; // Fantasy points
      gamesPlayed: number;
    }>();

    // Helper function to fetch boxscore
    const fetchBoxscore = async (gameId: number) => {
      try {
        const res = await fetch(`https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`);
        if (!res.ok) return null;
        return await res.json();
      } catch (e) {
        console.error(`Failed to fetch game ${gameId}`, e);
        return null;
      }
    };

    // Fetch in batches of 5 to avoid rate limits/timeouts
    const batchSize = 5;
    for (let i = 0; i < gamesToProcess.length; i += batchSize) {
      const batch = gamesToProcess.slice(i, i + batchSize);
      const boxscores = await Promise.all(batch.map(id => fetchBoxscore(id)));

      // Process batch
      for (const boxscore of boxscores) {
        if (!boxscore) continue;

        ['homeTeam', 'awayTeam'].forEach(teamKey => {
          const team = boxscore[teamKey];
          if (!team) return;
          const teamAbbrev = team.abbrev || 'UNK';

          // Skaters
          ['forwards', 'defense'].forEach(group => {
            (team.playerByGameStats?.[group] || []).forEach((p: any) => {
              if (!playerStats.has(p.playerId)) {
                playerStats.set(p.playerId, {
                  playerId: p.playerId,
                  name: p.name?.default || 'Unknown',
                  team: teamAbbrev,
                  position: p.position || 'F',
                  goals: 0, assists: 0, wins: 0, points: 0, gamesPlayed: 0
                });
              }
              const s = playerStats.get(p.playerId)!;
              s.goals += p.goals || 0;
              s.assists += p.assists || 0;
              s.points += (p.goals || 0) + (p.assists || 0);
              s.gamesPlayed++;
            });
          });

          // Goalies
          (team.playerByGameStats?.goalies || []).forEach((g: any) => {
            if (!playerStats.has(g.playerId)) {
              playerStats.set(g.playerId, {
                playerId: g.playerId,
                name: g.name?.default || 'Unknown',
                team: teamAbbrev,
                position: 'G',
                goals: 0, assists: 0, wins: 0, points: 0, gamesPlayed: 0
              });
            }
            const s = playerStats.get(g.playerId)!;
            if (g.decision === 'W') {
              s.wins++;
              s.points += 2;
            }
            s.gamesPlayed++;
          });
        });
      }
    }

    // Convert to array and sort
    const players = Array.from(playerStats.values())
      .filter(p => p.points > 0)
      .sort((a, b) => b.points - a.points);

    return res.status(200).json({
      players,
      gamesProcessed: gamesToProcess.length,
      period: 'Last 7 Days'
    });

  } catch (error) {
    console.error('Error fetching weekly stats:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
