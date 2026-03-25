// Vercel Serverless Function to calculate fantasy scores
// This will be called by a cron job daily

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { applyRosterSwaps } from './_lib/scoring/applyRosterSwaps';
import { processYesterdayScores } from './_lib/scoring/processYesterdayScores';
import { evaluateCronAccess } from './_lib/routeAccess';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const access = evaluateCronAccess(
    req,
    { cronSecret: process.env.CRON_SECRET, nodeEnv: process.env.NODE_ENV },
  );

  if (!access.allowed) {
    return res.status(access.statusCode).json(access.body);
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

    const swapResult = await applyRosterSwaps();

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
