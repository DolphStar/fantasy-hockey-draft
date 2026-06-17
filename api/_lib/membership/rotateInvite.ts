import { getAdminDb } from '../firebaseAdmin.js';
import { generateInviteCode } from './inviteCode.js';

export interface RotateInviteDeps {
  getCurrentCode: (leagueId: string) => Promise<string | undefined>;
  generateUniqueCode: () => Promise<string>;
  writeCode: (leagueId: string, code: string, oldCode?: string) => Promise<void>;
}

export async function rotateInvite(
  deps: RotateInviteDeps,
  { leagueId }: { leagueId: string },
): Promise<{ code: string }> {
  const oldCode = await deps.getCurrentCode(leagueId);
  const code = await deps.generateUniqueCode();
  await deps.writeCode(leagueId, code, oldCode);
  return { code };
}

export function defaultRotateInviteDeps(): RotateInviteDeps {
  return {
    getCurrentCode: async (leagueId) => {
      const db = await getAdminDb();
      const snap = await db.doc(`leagues/${leagueId}/private/invite`).get();
      return snap.exists ? (snap.data()?.code as string | undefined) : undefined;
    },
    generateUniqueCode: async () => {
      const db = await getAdminDb();
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateInviteCode();
        const existing = await db.doc(`inviteCodes/${code}`).get();
        if (!existing.exists) return code;
      }
      throw new Error('Could not generate a unique invite code');
    },
    writeCode: async (leagueId, code, oldCode) => {
      const db = await getAdminDb();
      const batch = db.batch();
      batch.set(db.doc(`inviteCodes/${code}`), { leagueId, createdAt: new Date().toISOString() });
      batch.set(db.doc(`leagues/${leagueId}/private/invite`), { code });
      if (oldCode && oldCode !== code) batch.delete(db.doc(`inviteCodes/${oldCode}`));
      await batch.commit();
    },
  };
}
