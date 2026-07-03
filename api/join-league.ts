import type { VercelRequest, VercelResponse } from '@vercel/node';

import { defaultUserAccessDeps, evaluateUserAccess } from './_lib/userAuth.js';
import { defaultJoinLeagueDeps, joinLeague } from './_lib/membership/joinLeague.js';
import { validateTeamName } from '../packages/core/membership/validateTeamName.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const access = await evaluateUserAccess(req, defaultUserAccessDeps());
  if (!access.allowed) return res.status(access.statusCode).json(access.body);

  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  if (!code) return res.status(400).json({ error: 'An invite code is required' });
  const teamNameCheck = validateTeamName(req.body?.teamName);
  if (!teamNameCheck.ok) return res.status(400).json({ error: teamNameCheck.error });
  const teamName = teamNameCheck.teamName;

  try {
    const result = await joinLeague(defaultJoinLeagueDeps(), { uid: access.uid, code, teamName });
    if (result.status === 'error') return res.status(result.statusCode).json({ error: result.message });
    return res.status(200).json({ success: true, leagueId: result.leagueId });
  } catch (error) {
    console.error('join-league failed:', error);
    return res.status(500).json({ error: 'Failed to join league' });
  }
}
