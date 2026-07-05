import type { VercelRequest, VercelResponse } from '@vercel/node';

import { defaultAdminAccessDeps, evaluateAdminAccess } from './_lib/adminAuth.js';
import { defaultEndSeasonDeps, endSeason, reopenSeason } from './_lib/season/endSeason.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const leagueId = typeof req.body?.leagueId === 'string' ? req.body.leagueId.trim() : '';
  if (!leagueId) return res.status(400).json({ error: 'A leagueId is required' });

  const action = req.body?.action ?? 'end';
  if (action !== 'end' && action !== 'reopen') {
    return res.status(400).json({ error: "action must be 'end' or 'reopen'" });
  }

  const access = await evaluateAdminAccess(req, leagueId, defaultAdminAccessDeps());
  if (!access.allowed) return res.status(access.statusCode).json(access.body);

  try {
    const deps = defaultEndSeasonDeps();
    const result = action === 'end'
      ? await endSeason(leagueId, 'admin', deps)
      : await reopenSeason(leagueId, deps);

    if (!result.success) return res.status(409).json({ error: result.error });
    return res.status(200).json({ success: true, seasonId: result.seasonId, champion: result.champion });
  } catch (error) {
    console.error('end-season failed:', error);
    return res.status(500).json({ error: 'Failed to update the season' });
  }
}
