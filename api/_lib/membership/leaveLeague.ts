import { FieldValue } from 'firebase-admin/firestore';

import { getAdminDb } from '../firebaseAdmin.js';

export type LeaveOutcome = 'left' | 'admin-cannot-leave' | 'not-found' | 'not-member';

export type LeaveResult =
  | { status: 'left' }
  | { status: 'error'; statusCode: number; message: string };

export interface LeaveLeagueDeps {
  applyLeave: (leagueId: string, uid: string) => Promise<LeaveOutcome>;
}

export async function leaveLeague(
  deps: LeaveLeagueDeps,
  { uid, leagueId }: { uid: string; leagueId: string },
): Promise<LeaveResult> {
  const outcome = await deps.applyLeave(leagueId, uid);
  switch (outcome) {
    case 'left':
    case 'not-member':
      return { status: 'left' }; // idempotent: not-a-member is treated as already-left
    case 'admin-cannot-leave':
      return { status: 'error', statusCode: 409, message: 'The admin cannot leave their own league. Delete the league instead.' };
    case 'not-found':
      return { status: 'error', statusCode: 404, message: 'League not found' };
  }
}

export function defaultLeaveLeagueDeps(): LeaveLeagueDeps {
  return {
    applyLeave: async (leagueId, uid) => {
      const db = await getAdminDb();
      const ref = db.doc(`leagues/${leagueId}`);
      return db.runTransaction(async (tx): Promise<LeaveOutcome> => {
        const snap = await tx.get(ref);
        if (!snap.exists) return 'not-found';
        const data = snap.data()!;
        if (data.admin === uid) return 'admin-cannot-leave';

        const teams = (data.teams ?? []) as { teamName: string; ownerUid: string }[];
        const owns = teams.some((t) => t.ownerUid === uid);
        const isMember = (data.memberUids ?? []).includes(uid);
        if (!owns && !isMember) return 'not-member';

        const nextTeams = teams.map((t) => (t.ownerUid === uid ? { ...t, ownerUid: '' } : t));
        tx.update(ref, {
          teams: nextTeams,
          memberUids: FieldValue.arrayRemove(uid),
          updatedAt: new Date().toISOString(),
        });
        return 'left';
      });
    },
  };
}
