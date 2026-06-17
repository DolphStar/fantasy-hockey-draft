import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from '../firebase';

async function authedPost(path: string, body: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You must be signed in');
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `Request failed (${res.status})`);
  return data;
}

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
