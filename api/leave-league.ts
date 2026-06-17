import type { VercelRequest, VercelResponse } from '@vercel/node';

import { defaultUserAccessDeps, evaluateUserAccess } from './_lib/userAuth.js';
import { defaultLeaveLeagueDeps, leaveLeague } from './_lib/membership/leaveLeague.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const access = await evaluateUserAccess(req, defaultUserAccessDeps());
  if (!access.allowed) return res.status(access.statusCode).json(access.body);

  const leagueId = typeof req.body?.leagueId === 'string' ? req.body.leagueId.trim() : '';
  if (!leagueId) return res.status(400).json({ error: 'A leagueId is required' });

  try {
    const result = await leaveLeague(defaultLeaveLeagueDeps(), { uid: access.uid, leagueId });
    if (result.status === 'error') return res.status(result.statusCode).json({ error: result.message });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('leave-league failed:', error);
    return res.status(500).json({ error: 'Failed to leave league' });
  }
}
