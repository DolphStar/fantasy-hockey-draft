import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function to fetch SEASON LEADERS
 * Used as a fast fallback for Waiver Wire / Hot Pickups
 * Uses NHL Leaders API for single-call performance
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Fetch Skater Leaders (Points)
    const response = await fetch('https://api-web.nhle.com/v1/skater-stats-leaders/current?categories=points&limit=100');
    
    if (!response.ok) {
      throw new Error(`NHL API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Map to our internal format
    // The API returns { points: [{ id, firstName, lastName, teamAbbrev, position, value }, ...] }
    const players = (data.points || []).map((p: any) => ({
      playerId: p.id,
      name: `${p.firstName.default || p.firstName} ${p.lastName.default || p.lastName}`,
      team: p.teamAbbrev,
      position: p.position,
      points: p.value, // Season points (goals + assists)
      goals: 0, // Not provided in summary
      assists: 0, // Not provided in summary
      gamesPlayed: 0 // Not provided in summary
    }));

    return res.status(200).json({
      players,
      source: 'NHL Leaders API',
      period: 'Season'
    });

  } catch (error) {
    console.error('Error fetching season stats:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
