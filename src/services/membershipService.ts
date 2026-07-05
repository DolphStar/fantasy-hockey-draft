import { doc, getDoc } from 'firebase/firestore';

import { db } from '../firebase';
import { authedPost } from './apiClient';

export async function joinLeagueByCode(code: string, teamName: string): Promise<string> {
  const data = await authedPost('/api/join-league', { code, teamName });
  return data.leagueId as string;
}

export async function leaveLeague(leagueId: string): Promise<void> {
  await authedPost('/api/leave-league', { leagueId });
}

export async function rotateInviteCode(leagueId: string): Promise<string> {
  const data = await authedPost('/api/rotate-invite', { leagueId });
  return data.code as string;
}

/** Admin-only read of the current invite code (rules gate this to the admin). */
export async function getInviteCode(leagueId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'leagues', leagueId, 'private', 'invite'));
  return snap.exists() ? ((snap.data().code as string) ?? null) : null;
}
