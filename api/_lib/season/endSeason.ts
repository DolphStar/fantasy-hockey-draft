/**
 * End (or reopen) a league season. endSeason snapshots final standings into
 * leagues/{id}/seasons/{seasonId}, flips the league to 'complete', and clears
 * pending roster swaps. Reopen is the safe inverse (archive is kept).
 */

import { buildSeasonArchive } from '../../../packages/core/season/buildSeasonArchive.js';
import { nhlSeasonIdForDate } from '../../../packages/core/season/seasonId.js';
import type { SeasonArchive } from '../../../packages/core/season/types.js';
import { getAdminDb } from '../firebaseAdmin.js';

export interface EndSeasonDeps {
  getLeague: (leagueId: string) => Promise<{
    status: string;
    teams: Array<{ teamName: string; ownerUid: string }>;
    currentSeasonId?: string;
  } | null>;
  getTeamScores: (leagueId: string) => Promise<Array<{ teamName: string; totalPoints: number }>>;
  getPlayerTotals: (leagueId: string) => Promise<Array<{
    playerId: number; name: string; position: string; nhlTeam: string;
    points: number; draftedByTeam: string;
  }>>;
  getPendingSwapDocIds: (leagueId: string) => Promise<string[]>;
  writeSeasonArchive: (leagueId: string, archive: SeasonArchive) => Promise<void>;
  updateLeague: (leagueId: string, patch: Record<string, unknown>) => Promise<void>;
  clearPendingSwap: (docId: string) => Promise<void>;
}

export type EndSeasonResult =
  | { success: true; seasonId: string; champion: string }
  | { success: false; error: string };

export async function endSeason(
  leagueId: string,
  endedBy: 'admin' | 'auto',
  deps: EndSeasonDeps,
  now: Date = new Date(),
): Promise<EndSeasonResult> {
  const league = await deps.getLeague(leagueId);
  if (!league) return { success: false, error: 'League not found' };
  if (league.status !== 'live' && league.status !== 'complete') {
    return { success: false, error: `Cannot end a ${league.status} league` };
  }

  const seasonId = league.currentSeasonId ?? nhlSeasonIdForDate(now);
  const [teamScores, playerTotals] = await Promise.all([
    deps.getTeamScores(leagueId),
    deps.getPlayerTotals(leagueId),
  ]);

  const archive = buildSeasonArchive({
    seasonId,
    endedAt: now.toISOString(),
    endedBy,
    teams: league.teams,
    teamScores,
    playerTotals,
  });

  await deps.writeSeasonArchive(leagueId, archive);
  await deps.updateLeague(leagueId, {
    status: 'complete',
    completedAt: now.toISOString(),
    currentSeasonId: seasonId,
    updatedAt: now.toISOString(),
  });

  const pendingIds = await deps.getPendingSwapDocIds(leagueId);
  for (const docId of pendingIds) {
    await deps.clearPendingSwap(docId);
  }

  return { success: true, seasonId, champion: archive.champion.teamName };
}

export async function reopenSeason(
  leagueId: string,
  deps: Pick<EndSeasonDeps, 'getLeague' | 'updateLeague'>,
  now: Date = new Date(),
): Promise<EndSeasonResult> {
  const league = await deps.getLeague(leagueId);
  if (!league) return { success: false, error: 'League not found' };
  if (league.status !== 'complete') {
    return { success: false, error: 'Only a complete league can be reopened' };
  }
  await deps.updateLeague(leagueId, {
    status: 'live',
    completedAt: null,
    updatedAt: now.toISOString(),
  });
  return { success: true, seasonId: league.currentSeasonId ?? '', champion: '' };
}

/** Production wiring (Admin SDK). */
export function defaultEndSeasonDeps(): EndSeasonDeps {
  return {
    getLeague: async (leagueId) => {
      const db = await getAdminDb();
      const snap = await db.doc(`leagues/${leagueId}`).get();
      if (!snap.exists) return null;
      const data = snap.data() ?? {};
      return {
        status: (data.status as string) ?? 'pending',
        teams: (data.teams as Array<{ teamName: string; ownerUid: string }>) ?? [],
        currentSeasonId: data.currentSeasonId as string | undefined,
      };
    },
    getTeamScores: async (leagueId) => {
      const db = await getAdminDb();
      const snap = await db.collection(`leagues/${leagueId}/teamScores`).get();
      return snap.docs.map((d) => ({
        teamName: (d.data().teamName as string) ?? d.id,
        totalPoints: (d.data().totalPoints as number) ?? 0,
      }));
    },
    getPlayerTotals: async (leagueId) => {
      const db = await getAdminDb();
      const [scoresSnap, playersSnap] = await Promise.all([
        db.collection(`leagues/${leagueId}/playerDailyScores`).get(),
        db.collection('draftedPlayers').where('leagueId', '==', leagueId).get(),
      ]);
      const positionByPlayerId = new Map<number, string>();
      playersSnap.docs.forEach((d) => {
        positionByPlayerId.set(d.data().playerId as number, (d.data().position as string) ?? '');
      });

      const totals = new Map<number, {
        playerId: number; name: string; position: string; nhlTeam: string;
        points: number; draftedByTeam: string;
      }>();
      scoresSnap.docs.forEach((d) => {
        const data = d.data() as {
          playerId: number; playerName: string; teamName: string; nhlTeam: string; points: number;
        };
        const existing = totals.get(data.playerId);
        if (existing) {
          existing.points += data.points;
          existing.nhlTeam = data.nhlTeam || existing.nhlTeam;
        } else {
          totals.set(data.playerId, {
            playerId: data.playerId,
            name: data.playerName,
            position: positionByPlayerId.get(data.playerId) ?? '',
            nhlTeam: data.nhlTeam,
            points: data.points,
            draftedByTeam: data.teamName,
          });
        }
      });
      return [...totals.values()];
    },
    getPendingSwapDocIds: async (leagueId) => {
      const db = await getAdminDb();
      const snap = await db
        .collection('draftedPlayers')
        .where('leagueId', '==', leagueId)
        .get();
      return snap.docs.filter((d) => d.data().pendingSlot).map((d) => d.id);
    },
    writeSeasonArchive: async (leagueId, archive) => {
      const db = await getAdminDb();
      await db.doc(`leagues/${leagueId}/seasons/${archive.seasonId}`).set(archive);
    },
    updateLeague: async (leagueId, patch) => {
      const db = await getAdminDb();
      await db.doc(`leagues/${leagueId}`).update(patch);
    },
    clearPendingSwap: async (docId) => {
      const db = await getAdminDb();
      await db.doc(`draftedPlayers/${docId}`).update({ pendingSlot: null, pendingSwapWith: null });
    },
  };
}
