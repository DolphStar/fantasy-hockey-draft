/**
 * Pure per-league daily scoring. Receives pre-fetched NHL game data and persists
 * results through injectable deps. Returns a structured result (no throwing) for
 * expected skips so the orchestrator can isolate them per league.
 */

import { FieldValue } from 'firebase-admin/firestore';

import type { AggregatedPlayerScore } from '../../../packages/core/scoring/aggregateDailyScores.js';
import { aggregateDailyScores } from '../../../packages/core/scoring/aggregateDailyScores.js';
import {
  buildTeamAggregate,
  foldDailyScores,
} from '../../../packages/core/scoring/seasonAggregate.js';
import type { TeamSeasonAggregate } from '../../../packages/core/scoring/seasonAggregate.js';
import type { ScoringRules } from '../../../packages/core/scoring/types.js';

import { getAdminDb } from '../firebaseAdmin.js';
import { type DailyGameStats, filterGameStatsByType } from './fetchDailyGameStats.js';
import { buildActivePlayerToTeamMap, type DraftedPlayerRow } from './helpers.js';

const BATCH_LIMIT = 500;

export type ScoreLeagueReason = 'not-live' | 'already-processed' | 'no-scoring-rules';

export interface ScoreLeagueResult {
  leagueId: string;
  status: 'scored' | 'skipped';
  reason?: ScoreLeagueReason;
  gamesProcessed?: number;
  teamsUpdated?: number;
  playerPerformances?: number;
}

export interface LeagueForScoring {
  status: string;
  scoringRules?: ScoringRules;
  allowedGameTypes?: number[];
}

export interface PersistDailyScoresArgs {
  leagueId: string;
  date: string;
  teamPoints: Map<string, number>;
  playerScores: AggregatedPlayerScore[];
  gamesProcessed: number;
}

export interface ScoreLeagueDeps {
  getLeague: (leagueId: string) => Promise<LeagueForScoring | null>;
  isDateProcessed: (leagueId: string, date: string) => Promise<boolean>;
  getActiveRoster: (leagueId: string) => Promise<DraftedPlayerRow[]>;
  persistDailyScores: (args: PersistDailyScoresArgs) => Promise<void>;
}

export async function scoreLeagueForDate(
  leagueId: string,
  date: string,
  games: DailyGameStats[],
  deps: ScoreLeagueDeps = defaultScoreLeagueDeps(),
): Promise<ScoreLeagueResult> {
  const league = await deps.getLeague(leagueId);
  if (!league) {
    throw new Error(`League ${leagueId} not found`);
  }

  if (league.status !== 'live') {
    return { leagueId, status: 'skipped', reason: 'not-live' };
  }
  if (!league.scoringRules) {
    return { leagueId, status: 'skipped', reason: 'no-scoring-rules' };
  }
  if (await deps.isDateProcessed(leagueId, date)) {
    return { leagueId, status: 'skipped', reason: 'already-processed' };
  }

  const allowedGameTypes = league.allowedGameTypes ?? [2];
  const { included, skippedTypeCount } = filterGameStatsByType(games, allowedGameTypes);
  if (skippedTypeCount > 0) {
    console.log(
      `League ${leagueId}: skipped ${skippedTypeCount} games outside allowed gameTypes (${allowedGameTypes.join(',')})`,
    );
  }

  const rows = await deps.getActiveRoster(leagueId);
  const { playerToTeamMap, reserveCount } = buildActivePlayerToTeamMap(rows);
  console.log(
    `League ${leagueId}: ${playerToTeamMap.size} active players (${reserveCount} reserves excluded)`,
  );

  const playersByGame = included.map((g) => g.players);
  const { teamPoints, playerScores } = aggregateDailyScores(
    playersByGame,
    playerToTeamMap,
    league.scoringRules,
    date,
  );

  await deps.persistDailyScores({
    leagueId,
    date,
    teamPoints,
    playerScores,
    gamesProcessed: included.length,
  });

  return {
    leagueId,
    status: 'scored',
    gamesProcessed: included.length,
    teamsUpdated: teamPoints.size,
    playerPerformances: playerScores.length,
  };
}

/** Production wiring: Firebase Admin reads + writes (relocated from processYesterdayScores). */
export function defaultScoreLeagueDeps(): ScoreLeagueDeps {
  return {
    getLeague: async (leagueId) => {
      const db = await getAdminDb();
      const snap = await db.doc(`leagues/${leagueId}`).get();
      if (!snap.exists) return null;
      const data = snap.data()!;
      return {
        status: data.status,
        scoringRules: data.scoringRules as ScoringRules | undefined,
        allowedGameTypes: data.allowedGameTypes as number[] | undefined,
      };
    },

    isDateProcessed: async (leagueId, date) => {
      const db = await getAdminDb();
      const snap = await db.doc(`leagues/${leagueId}/processedDates/${date}`).get();
      return snap.exists;
    },

    getActiveRoster: async (leagueId) => {
      const db = await getAdminDb();
      const snapshot = await db
        .collection('draftedPlayers')
        .where('leagueId', '==', leagueId)
        .get();
      return snapshot.docs.map((d) => d.data() as DraftedPlayerRow);
    },

    persistDailyScores: async ({ leagueId, date, teamPoints, playerScores, gamesProcessed }) => {
      const db = await getAdminDb();

      // 1) Team scores (increment, or create on first write).
      for (const [teamName, points] of teamPoints.entries()) {
        if (isNaN(points) || !isFinite(points)) {
          console.warn(`Skipping ${teamName}: invalid points (${points})`);
          continue;
        }
        const teamScoreRef = db.doc(`leagues/${leagueId}/teamScores/${teamName}`);
        try {
          await teamScoreRef.update({
            totalPoints: FieldValue.increment(points),
            lastUpdated: new Date().toISOString(),
          });
        } catch {
          await teamScoreRef.set({
            teamName,
            totalPoints: points,
            wins: 0,
            losses: 0,
            lastUpdated: new Date().toISOString(),
          });
        }
      }

      // 2) Player daily scores (batched). Written BEFORE the aggregate bootstrap
      //    scan so a first-time bootstrap sees today's rows.
      for (let i = 0; i < playerScores.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        for (const playerScore of playerScores.slice(i, i + BATCH_LIMIT)) {
          const scoreRef = db.doc(
            `leagues/${leagueId}/playerDailyScores/${playerScore.playerId}-${date}`,
          );
          batch.set(scoreRef, playerScore);
        }
        await batch.commit();
      }

      // 3) Season aggregates: bootstrap from full scan on first run, else fold today in.
      const aggregatesCol = db.collection(`leagues/${leagueId}/aggregates`);
      const scoresByTeam = new Map<string, AggregatedPlayerScore[]>();
      for (const score of playerScores) {
        const list = scoresByTeam.get(score.teamName) ?? [];
        list.push(score);
        scoresByTeam.set(score.teamName, list);
      }

      const anyAggregate = await aggregatesCol.limit(1).get();
      if (anyAggregate.empty) {
        const allScoresSnap = await db.collection(`leagues/${leagueId}/playerDailyScores`).get();
        const allByTeam = new Map<string, AggregatedPlayerScore[]>();
        for (const docSnap of allScoresSnap.docs) {
          const data = docSnap.data() as AggregatedPlayerScore;
          const list = allByTeam.get(data.teamName) ?? [];
          list.push(data);
          allByTeam.set(data.teamName, list);
        }
        const aggregateBatch = db.batch();
        for (const [teamName, scores] of allByTeam) {
          const agg = buildTeamAggregate(teamName, scores);
          aggregateBatch.set(aggregatesCol.doc(teamName), {
            ...agg,
            lastUpdated: new Date().toISOString(),
          });
        }
        await aggregateBatch.commit();
      } else {
        for (const [teamName, scores] of scoresByTeam) {
          const ref = aggregatesCol.doc(teamName);
          await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const prev = snap.exists ? (snap.data() as TeamSeasonAggregate) : null;
            const next = foldDailyScores(prev, teamName, scores);
            tx.set(ref, { ...next, lastUpdated: new Date().toISOString() });
          });
        }
      }

      // 4) Mark the date processed (idempotency).
      await db.doc(`leagues/${leagueId}/processedDates/${date}`).set({
        date,
        processedAt: new Date().toISOString(),
        gamesProcessed,
        teamsUpdated: teamPoints.size,
        playerPerformances: playerScores.length,
      });
    },
  };
}
