import type { VercelRequest, VercelResponse } from '@vercel/node';

import { defaultAdminAccessDeps, evaluateAdminAccess } from './_lib/adminAuth.js';
import { defaultNewSeasonDeps, startNewSeason } from './_lib/season/newSeason.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const leagueId = typeof req.body?.leagueId === 'string' ? req.body.leagueId.trim() : '';
  if (!leagueId) return res.status(400).json({ error: 'A leagueId is required' });

  const access = await evaluateAdminAccess(req, leagueId, defaultAdminAccessDeps());
  if (!access.allowed) return res.status(access.statusCode).json(access.body);

  try {
    const result = await startNewSeason(leagueId, defaultNewSeasonDeps());
    if (!result.success) return res.status(409).json({ error: result.error });
    return res.status(200).json({ success: true, newSeasonId: result.newSeasonId });
  } catch (error) {
    console.error('new-season failed:', error);
    return res.status(500).json({ error: 'Failed to start a new season' });
  }
}
