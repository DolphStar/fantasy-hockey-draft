import type { VercelRequest, VercelResponse } from '@vercel/node';

import { evaluateAdminAccess, defaultAdminAccessDeps } from './_lib/adminAuth.js';
import { evaluateCronAccess } from './_lib/routeAccess.js';
import {
  defaultDailyScoringDeps,
  runDailyScoring,
} from './_lib/scoring/runDailyScoring.js';
import type { ScoreLeagueReason } from './_lib/scoring/scoreLeagueForDate.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const SKIP_STATUS: Record<ScoreLeagueReason, number> = {
  'already-processed': 409,
  'not-live': 400,
  'no-scoring-rules': 400,
};

function skipMessage(reason: ScoreLeagueReason, date: string): string {
  switch (reason) {
    case 'already-processed':
      return `Date ${date} has already been scored. Use "Clear Scores" first if you need to re-calculate.`;
    case 'not-live':
      return 'League is not active. Complete the draft first before scoring begins.';
    case 'no-scoring-rules':
      return 'League does not have scoring rules configured. Please update the league with scoring rules first.';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const leagueId = typeof req.query.leagueId === 'string' ? req.query.leagueId : undefined;

  const targetDate = req.query.date as string | undefined;
  if (targetDate !== undefined && !DATE_PATTERN.test(targetDate)) {
    return res.status(400).json({ error: 'Invalid date; expected YYYY-MM-DD' });
  }

  // Auth: an all-leagues run (no leagueId) requires cron access. A single-league
  // run also accepts that league's admin Firebase ID token (in-app Test Scoring).
  const cronAccess = evaluateCronAccess(req, {
    cronSecret: process.env.CRON_SECRET,
    nodeEnv: process.env.NODE_ENV,
  });

  if (!cronAccess.allowed) {
    if (!leagueId) {
      return res.status(cronAccess.statusCode).json(cronAccess.body);
    }
    const adminAccess = await evaluateAdminAccess(req, leagueId, defaultAdminAccessDeps());
    if (!adminAccess.allowed) {
      return res.status(adminAccess.statusCode).json(adminAccess.body);
    }
  }

  try {
    const summary = await runDailyScoring(defaultDailyScoringDeps(), { leagueId, date: targetDate });

    // Single-league (admin) mode: surface skips/errors as HTTP errors so the
    // Test Scoring button shows the message.
    if (leagueId) {
      const result = summary.results[0];
      if (result?.status === 'error') {
        return res.status(500).json({ error: 'Failed to calculate scores', message: result.error });
      }
      if (result?.status === 'skipped' && result.reason) {
        return res
          .status(SKIP_STATUS[result.reason])
          .json({ error: skipMessage(result.reason, summary.date) });
      }
    }

    return res.status(200).json({ success: true, ...summary, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error calculating scores:', error);
    return res.status(500).json({
      error: 'Failed to calculate scores',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
