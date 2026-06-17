import type { VercelRequest, VercelResponse } from '@vercel/node';

import { defaultUserAccessDeps, evaluateUserAccess } from './_lib/userAuth.js';
import { defaultJoinLeagueDeps, joinLeague } from './_lib/membership/joinLeague.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const access = await evaluateUserAccess(req, defaultUserAccessDeps());
  if (!access.allowed) return res.status(access.statusCode).json(access.body);

  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const teamName = typeof req.body?.teamName === 'string' ? req.body.teamName.trim() : '';
  if (!code) return res.status(400).json({ error: 'An invite code is required' });
  if (!teamName) return res.status(400).json({ error: 'A team name is required' });
  if (teamName.length > 40) return res.status(400).json({ error: 'Team name is too long' });

  try {
    const result = await joinLeague(defaultJoinLeagueDeps(), { uid: access.uid, code, teamName });
    if (result.status === 'error') return res.status(result.statusCode).json({ error: result.message });
    return res.status(200).json({ success: true, leagueId: result.leagueId });
  } catch (error) {
    console.error('join-league failed:', error);
    return res.status(500).json({ error: 'Failed to join league' });
  }
}
