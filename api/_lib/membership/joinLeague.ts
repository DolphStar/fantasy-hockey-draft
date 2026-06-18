import { FieldValue } from 'firebase-admin/firestore';

import { getAdminDb } from '../firebaseAdmin.js';
import { resolveJoinTarget } from '../../../packages/core/membership/resolveJoinTarget.js';

const DEFAULT_MAX_TEAMS = 12;

export type JoinOutcome = 'joined' | 'already' | 'full' | 'not-pending' | 'not-found';

export type JoinResult =
  | { status: 'joined'; leagueId: string }
  | { status: 'error'; statusCode: number; message: string };

export interface JoinLeagueDeps {
  resolveCode: (code: string) => Promise<string | null>;
  applyJoin: (leagueId: string, uid: string, teamName: string) => Promise<JoinOutcome>;
}

export async function joinLeague(
  deps: JoinLeagueDeps,
  { uid, code, teamName }: { uid: string; code: string; teamName: string },
): Promise<JoinResult> {
  const leagueId = await deps.resolveCode(code);
  if (!leagueId) return { status: 'error', statusCode: 404, message: 'Invalid invite code' };

  const outcome = await deps.applyJoin(leagueId, uid, teamName);
  switch (outcome) {
    case 'joined':
    case 'already':
      return { status: 'joined', leagueId };
    case 'full':
      return { status: 'error', statusCode: 409, message: 'This league is full' };
    case 'not-pending':
      return { status: 'error', statusCode: 409, message: 'This league has already started its draft' };
    case 'not-found':
      return { status: 'error', statusCode: 404, message: 'League not found' };
  }
}

export function defaultJoinLeagueDeps(): JoinLeagueDeps {
  return {
    resolveCode: async (code) => {
      const db = await getAdminDb();
      const snap = await db.doc(`inviteCodes/${code}`).get();
      return snap.exists ? ((snap.data()?.leagueId as string) ?? null) : null;
    },
    applyJoin: async (leagueId, uid, teamName) => {
      const db = await getAdminDb();
      const ref = db.doc(`leagues/${leagueId}`);
      return db.runTransaction(async (tx): Promise<JoinOutcome> => {
        const snap = await tx.get(ref);
        if (!snap.exists) return 'not-found';
        const data = snap.data()!;
        if (data.status !== 'pending') return 'not-pending';

        const teams = (data.teams ?? []) as { teamName: string; ownerUid: string }[];
        const maxTeams = (data.maxTeams as number) ?? DEFAULT_MAX_TEAMS;
        const target = resolveJoinTarget(teams, maxTeams, uid);

        if (target.kind === 'already') return 'already';
        if (target.kind === 'full') return 'full';

        const nextTeams = [...teams];
        if (target.kind === 'claim') {
          nextTeams[target.index] = { ...nextTeams[target.index], ownerUid: uid, teamName };
        } else {
          nextTeams.push({ teamName, ownerUid: uid });
        }
        tx.update(ref, {
          teams: nextTeams,
          memberUids: FieldValue.arrayUnion(uid),
          updatedAt: new Date().toISOString(),
        });
        return 'joined';
      });
    },
  };
}
