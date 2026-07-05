/**
 * Reset a complete league for a new season. Refuses to delete anything until
 * the finished season's archive doc is confirmed to exist. Preserves: teams,
 * members, invite code, seasons/ history, chat.
 */

import { nextSeasonId } from '../../../packages/core/season/seasonId.js';
import { getAdminDb } from '../firebaseAdmin.js';

export interface NewSeasonDeps {
  getLeague: (leagueId: string) => Promise<{ status: string; currentSeasonId?: string } | null>;
  seasonArchiveExists: (leagueId: string, seasonId: string) => Promise<boolean>;
  deleteLeagueDraftedPlayers: (leagueId: string) => Promise<number>;
  deleteDraftDoc: (leagueId: string) => Promise<void>;
  deleteSubcollection: (
    leagueId: string,
    name: 'teamScores' | 'playerDailyScores' | 'aggregates' | 'processedDates',
  ) => Promise<number>;
  updateLeague: (leagueId: string, patch: Record<string, unknown>) => Promise<void>;
}

export type NewSeasonResult =
  | { success: true; newSeasonId: string }
  | { success: false; error: string };

const SEASON_SUBCOLLECTIONS = ['teamScores', 'playerDailyScores', 'aggregates', 'processedDates'] as const;

export async function startNewSeason(
  leagueId: string,
  deps: NewSeasonDeps,
  now: Date = new Date(),
): Promise<NewSeasonResult> {
  const league = await deps.getLeague(leagueId);
  if (!league) return { success: false, error: 'League not found' };
  if (league.status !== 'complete') {
    return { success: false, error: 'End the season before starting a new one' };
  }
  if (!league.currentSeasonId) {
    return { success: false, error: 'League has no season id; end the season first' };
  }
  const archived = await deps.seasonArchiveExists(leagueId, league.currentSeasonId);
  if (!archived) {
    return { success: false, error: 'No season archive found; end the season first so history is preserved' };
  }

  await deps.deleteLeagueDraftedPlayers(leagueId);
  await deps.deleteDraftDoc(leagueId);
  for (const name of SEASON_SUBCOLLECTIONS) {
    await deps.deleteSubcollection(leagueId, name);
  }

  const newId = nextSeasonId(league.currentSeasonId);
  await deps.updateLeague(leagueId, {
    status: 'pending',
    currentSeasonId: newId,
    completedAt: null,
    updatedAt: now.toISOString(),
  });

  return { success: true, newSeasonId: newId };
}

const DELETE_BATCH_SIZE = 400;

/** Production wiring (Admin SDK). Batched deletes stay under the 500-write limit. */
export function defaultNewSeasonDeps(): NewSeasonDeps {
  async function deleteInBatches(
    getDocs: () => Promise<FirebaseFirestore.QuerySnapshot>,
  ): Promise<number> {
    const db = await getAdminDb();
    let deleted = 0;
    for (;;) {
      const snap = await getDocs();
      if (snap.empty) return deleted;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      deleted += snap.docs.length;
      if (snap.docs.length < DELETE_BATCH_SIZE) return deleted;
    }
  }

  return {
    getLeague: async (leagueId) => {
      const db = await getAdminDb();
      const snap = await db.doc(`leagues/${leagueId}`).get();
      if (!snap.exists) return null;
      return {
        status: (snap.data()?.status as string) ?? 'pending',
        currentSeasonId: snap.data()?.currentSeasonId as string | undefined,
      };
    },
    seasonArchiveExists: async (leagueId, seasonId) => {
      const db = await getAdminDb();
      const snap = await db.doc(`leagues/${leagueId}/seasons/${seasonId}`).get();
      return snap.exists;
    },
    deleteLeagueDraftedPlayers: async (leagueId) => {
      const db = await getAdminDb();
      return deleteInBatches(() =>
        db.collection('draftedPlayers').where('leagueId', '==', leagueId).limit(DELETE_BATCH_SIZE).get(),
      );
    },
    deleteDraftDoc: async (leagueId) => {
      const db = await getAdminDb();
      await db.doc(`drafts/${leagueId}`).delete();
    },
    deleteSubcollection: async (leagueId, name) => {
      const db = await getAdminDb();
      return deleteInBatches(() =>
        db.collection(`leagues/${leagueId}/${name}`).limit(DELETE_BATCH_SIZE).get(),
      );
    },
    updateLeague: async (leagueId, patch) => {
      const db = await getAdminDb();
      await db.doc(`leagues/${leagueId}`).update(patch);
    },
  };
}
