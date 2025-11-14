// Vercel Serverless Function to calculate fantasy scores
// This will be called by a cron job daily

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify this is called by Vercel Cron (security check)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Starting daily score calculation...');
    
    // Get league ID from query or environment
    const leagueId = req.query.leagueId as string || process.env.DEFAULT_LEAGUE_ID;
    
    if (!leagueId) {
      return res.status(400).json({ 
        error: 'No league ID provided' 
      });
    }

    // Import the scoring engine and roster swaps (dynamic import for serverless)
    const { processYesterdayScores } = await import('../src/utils/scoringEngine');
    const { applyRosterSwaps } = await import('../src/utils/applyRosterSwaps');
    
    // Apply roster swaps if it's Saturday
    const swapResult = await applyRosterSwaps();
    
    // Run the scoring calculation
    await processYesterdayScores(leagueId);
    
    console.log(`Successfully calculated scores for league: ${leagueId}`);
    
    return res.status(200).json({ 
      success: true,
      message: `Scores calculated for league ${leagueId}`,
      timestamp: new Date().toISOString(),
      rosterSwaps: swapResult
    });
    
  } catch (error) {
    console.error('Error calculating scores:', error);
    
    return res.status(500).json({ 
      error: 'Failed to calculate scores',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
