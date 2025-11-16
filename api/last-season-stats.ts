import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function to fetch NHL Stats API
 * This bypasses CORS by making the request server-side
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
    const seasonId = "20232024";
    const gameTypeId = "2";

    // Fetch both skaters and goalies in parallel
    const [skatersRes, goaliesRes] = await Promise.all([
      fetch(`https://api.nhle.com/stats/rest/en/skater/summary?limit=-1&cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=${gameTypeId}`),
      fetch(`https://api.nhle.com/stats/rest/en/goalie/summary?limit=-1&cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=${gameTypeId}`)
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

    // Combine and return both datasets
    return res.status(200).json({
      skaters: skatersData.data,
      goalies: goaliesData.data,
      totalPlayers: skatersData.data.length + goaliesData.data.length
    });

  } catch (error) {
    console.error('Error fetching last season stats:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
