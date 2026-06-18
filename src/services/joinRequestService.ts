import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
} from 'firebase/firestore';

import { db } from '../firebase';
import { resolveJoinTarget } from '../../packages/core/membership/resolveJoinTarget';

export interface JoinRequest {
  uid: string;
  teamName: string;
  requestedAt: string;
}

/** Requester writes their own request doc (rules: create allowed when uid === self). */
export async function requestToJoin(leagueId: string, uid: string, teamName: string): Promise<void> {
  await setDoc(doc(db, 'leagues', leagueId, 'joinRequests', uid), {
    uid,
    teamName,
    requestedAt: new Date().toISOString(),
  });
}

export async function cancelJoinRequest(leagueId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, 'leagues', leagueId, 'joinRequests', uid));
}

/** Read the caller's own request for a league (to show Requested/Cancel state). */
export async function getMyJoinRequest(leagueId: string, uid: string): Promise<JoinRequest | null> {
  const snap = await getDoc(doc(db, 'leagues', leagueId, 'joinRequests', uid));
  return snap.exists() ? (snap.data() as JoinRequest) : null;
}

/** Admin: live list of pending requests for a league. */
export function subscribeToJoinRequests(
  leagueId: string,
  onRequests: (requests: JoinRequest[]) => void,
): () => void {
  return onSnapshot(collection(db, 'leagues', leagueId, 'joinRequests'), (snap) => {
    onRequests(snap.docs.map((d) => d.data() as JoinRequest));
  });
}

/**
 * Admin approves a request: add the requester to the league (claim an open slot or
 * append a team) + memberUids, then delete the request — all in one transaction.
 * The admin already has league-doc write permission (Firestore rules), so no server
 * endpoint is needed.
 */
export async function approveJoinRequest(
  leagueId: string,
  requesterUid: string,
  teamName: string,
): Promise<void> {
  const leagueRef = doc(db, 'leagues', leagueId);
  const requestRef = doc(db, 'leagues', leagueId, 'joinRequests', requesterUid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(leagueRef);
    if (!snap.exists()) throw new Error('League not found');
    const data = snap.data() as {
      status: string;
      teams: { teamName: string; ownerUid: string }[];
      maxTeams?: number;
    };
    if (data.status !== 'pending') throw new Error('This league has already started its draft');

    const teams = data.teams ?? [];
    const target = resolveJoinTarget(teams, data.maxTeams ?? 12, requesterUid);
    if (target.kind === 'full') throw new Error('This league is full');

    let nextTeams = teams;
    if (target.kind === 'claim') {
      nextTeams = teams.map((t, i) =>
        i === target.index ? { ...t, ownerUid: requesterUid, teamName } : t,
      );
    } else if (target.kind === 'append') {
      nextTeams = [...teams, { teamName, ownerUid: requesterUid }];
    }

    tx.update(leagueRef, {
      teams: nextTeams,
      memberUids: arrayUnion(requesterUid),
      updatedAt: new Date().toISOString(),
    });
    tx.delete(requestRef);
  });
}

export async function denyJoinRequest(leagueId: string, requesterUid: string): Promise<void> {
  await deleteDoc(doc(db, 'leagues', leagueId, 'joinRequests', requesterUid));
}
