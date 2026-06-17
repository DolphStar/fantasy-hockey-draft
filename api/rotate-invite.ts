import type { VercelRequest, VercelResponse } from '@vercel/node';

import { defaultAdminAccessDeps, evaluateAdminAccess } from './_lib/adminAuth.js';
import { defaultRotateInviteDeps, rotateInvite } from './_lib/membership/rotateInvite.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const leagueId = typeof req.body?.leagueId === 'string' ? req.body.leagueId.trim() : '';
  if (!leagueId) return res.status(400).json({ error: 'A leagueId is required' });

  const access = await evaluateAdminAccess(req, leagueId, defaultAdminAccessDeps());
  if (!access.allowed) return res.status(access.statusCode).json(access.body);

  try {
    const { code } = await rotateInvite(defaultRotateInviteDeps(), { leagueId });
    return res.status(200).json({ success: true, code });
  } catch (error) {
    console.error('rotate-invite failed:', error);
    return res.status(500).json({ error: 'Failed to rotate invite code' });
  }
}
