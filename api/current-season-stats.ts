import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function to fetch CURRENT SEASON NHL Stats
 * Used for Waiver Wire / Hot Pickups feature
 * Returns top performers this season (undrafted players)
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
    const seasonId = "20252026"; // Current season (2025-2026)
    const gameTypeId = "2"; // Regular season

    // Fetch both skaters and goalies in parallel
    const [skatersRes, goaliesRes] = await Promise.all([
      fetch(`https://api.nhle.com/stats/rest/en/skater/summary?limit=100&sort=[{"property":"points","direction":"DESC"}]&cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=${gameTypeId}`),
      fetch(`https://api.nhle.com/stats/rest/en/goalie/summary?limit=50&sort=[{"property":"wins","direction":"DESC"}]&cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=${gameTypeId}`)
    ]);

    if (!skatersRes.ok || !goaliesRes.ok) {
      console.error('NHL Stats API Error:', {
        skatersStatus: skatersRes.status,
        goaliesStatus: goaliesRes.status
      });
      return res.status(500).json({ 
        error: 'Failed to fetch stats from NHL API',
        skatersStatus: skatersRes.status,
        goaliesStatus: goaliesRes.status
      });
    }

    const [skatersData, goaliesData] = await Promise.all([
      skatersRes.json(),
      goaliesRes.json()
    ]);

    // Process into unified player format
    const players: any[] = [];

    // Process skaters
    if (skatersData.data) {
      skatersData.data.forEach((player: any) => {
        players.push({
          playerId: player.playerId,
          name: player.skaterFullName,
          team: player.teamAbbrevs?.split(',')[0] || 'FA',
          position: player.positionCode || 'F',
          goals: player.goals || 0,
          assists: player.assists || 0,
          points: (player.goals || 0) + (player.assists || 0),
          gamesPlayed: player.gamesPlayed || 0
        });
      });
    }

    // Process goalies
    if (goaliesData.data) {
      goaliesData.data.forEach((player: any) => {
        players.push({
          playerId: player.playerId,
          name: player.goalieFullName,
          team: player.teamAbbrevs?.split(',')[0] || 'FA',
          position: 'G',
          goals: 0,
          assists: 0,
          wins: player.wins || 0,
          points: (player.wins || 0) * 2, // 2 pts per win
          gamesPlayed: player.gamesPlayed || 0
        });
      });
    }

    // Sort by points
    players.sort((a, b) => b.points - a.points);

    return res.status(200).json({
      players,
      season: seasonId,
      totalPlayers: players.length
    });

  } catch (error) {
    console.error('Error fetching current season stats:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
