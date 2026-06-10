import type { VercelRequest, VercelResponse } from '@vercel/node';

import { evaluateAdminAccess, defaultAdminAccessDeps } from './_lib/adminAuth.js';
import { applyRosterSwaps } from './_lib/scoring/applyRosterSwaps.js';
import { processYesterdayScores } from './_lib/scoring/processYesterdayScores.js';
import { evaluateCronAccess } from './_lib/routeAccess.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const leagueId = (req.query.leagueId as string) || process.env.DEFAULT_LEAGUE_ID;
  if (!leagueId) {
    return res.status(400).json({ error: 'No league ID provided' });
  }

  const targetDate = req.query.date as string | undefined;
  if (targetDate !== undefined && !DATE_PATTERN.test(targetDate)) {
    return res.status(400).json({ error: 'Invalid date; expected YYYY-MM-DD' });
  }

  const cronAccess = evaluateCronAccess(
    req,
    { cronSecret: process.env.CRON_SECRET, nodeEnv: process.env.NODE_ENV },
  );

  if (!cronAccess.allowed) {
    // Fall back to league-admin Firebase ID token (used by the in-app admin tools).
    const adminAccess = await evaluateAdminAccess(req, leagueId, defaultAdminAccessDeps());
    if (!adminAccess.allowed) {
      return res.status(adminAccess.statusCode).json(adminAccess.body);
    }
  }

  try {
    console.log('Starting daily score calculation...');

    const swapResult = await applyRosterSwaps();
    await processYesterdayScores(leagueId, targetDate);

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
