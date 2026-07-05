/**
 * Orchestrates daily scoring across leagues: resolves the date once, fetches NHL
 * data once, then applies roster swaps + scores each league with per-league
 * failure isolation.
 */

import { getPreviousNewYorkDateString } from '../../../packages/core/dates/dateUtils.js';
import { isSeasonOver } from '../../../packages/core/season/isSeasonOver.js';
import { getAdminDb } from '../firebaseAdmin.js';
import { defaultEndSeasonDeps, endSeason } from '../season/endSeason.js';
import {
  applyRosterSwaps as applyRosterSwapsImpl,
  type RosterSwapResult,
} from './applyRosterSwaps.js';
import {
  fetchDailyGameStats as fetchDailyGameStatsImpl,
  type DailyGameStats,
} from './fetchDailyGameStats.js';
import {
  scoreLeagueForDate as scoreLeagueForDateImpl,
  type ScoreLeagueResult,
} from './scoreLeagueForDate.js';

export type LeagueScoringOutcome =
  | ScoreLeagueResult
  | { leagueId: string; status: 'error'; error: string };

export interface DailyScoringSummary {
  date: string;
  leaguesScored: number;
  leaguesSkipped: number;
  leaguesErrored: number;
  rosterSwapsApplied: number;
  leaguesAutoEnded: number;
  results: LeagueScoringOutcome[];
}

export interface DailyScoringDeps {
  now: () => Date;
  resolveDate: (opts: { date?: string }) => string;
  listLiveLeagueIds: () => Promise<string[]>;
  fetchDailyGameStats: (date: string) => Promise<DailyGameStats[]>;
  applyRosterSwaps: (leagueId: string, now: Date) => Promise<RosterSwapResult>;
  scoreLeagueForDate: (
    leagueId: string,
    date: string,
    games: DailyGameStats[],
  ) => Promise<ScoreLeagueResult>;
  maybeAutoEndSeason: (leagueId: string, now: Date) => Promise<boolean>;
}

export async function runDailyScoring(
  deps: DailyScoringDeps,
  opts: { leagueId?: string; date?: string },
): Promise<DailyScoringSummary> {
  const date = deps.resolveDate({ date: opts.date });
  const games = await deps.fetchDailyGameStats(date);
  const now = deps.now();

  const leagueIds = opts.leagueId ? [opts.leagueId] : await deps.listLiveLeagueIds();

  const results: LeagueScoringOutcome[] = [];
  let rosterSwapsApplied = 0;
  let leaguesAutoEnded = 0;

  for (const leagueId of leagueIds) {
    try {
      const swap = await deps.applyRosterSwaps(leagueId, now);
      rosterSwapsApplied += swap.swapsApplied;
      const result = await deps.scoreLeagueForDate(leagueId, date, games);
      results.push(result);
      if (await deps.maybeAutoEndSeason(leagueId, now)) leaguesAutoEnded++;
    } catch (error) {
      console.error(`League ${leagueId}: scoring failed:`, error);
      results.push({
        leagueId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    date,
    leaguesScored: results.filter((r) => r.status === 'scored').length,
    leaguesSkipped: results.filter((r) => r.status === 'skipped').length,
    leaguesErrored: results.filter((r) => r.status === 'error').length,
    rosterSwapsApplied,
    leaguesAutoEnded,
    results,
  };
}

/** Production wiring. */
export function defaultDailyScoringDeps(): DailyScoringDeps {
  return {
    now: () => new Date(),
    resolveDate: ({ date }) => date ?? getPreviousNewYorkDateString(),
    listLiveLeagueIds: async () => {
      const db = await getAdminDb();
      const snapshot = await db.collection('leagues').where('status', '==', 'live').get();
      return snapshot.docs.map((d) => d.id);
    },
    fetchDailyGameStats: fetchDailyGameStatsImpl,
    applyRosterSwaps: (leagueId, now) => applyRosterSwapsImpl(leagueId, now),
    scoreLeagueForDate: (leagueId, date, games) => scoreLeagueForDateImpl(leagueId, date, games),
    maybeAutoEndSeason: async (leagueId, now) => {
      const db = await getAdminDb();
      const snap = await db
        .collection(`leagues/${leagueId}/playerDailyScores`)
        .orderBy('date', 'desc')
        .limit(1)
        .get();
      const lastActivityDate = snap.empty ? null : ((snap.docs[0].data().date as string) ?? null);
      if (!isSeasonOver(now, lastActivityDate)) return false;
      const result = await endSeason(leagueId, 'auto', defaultEndSeasonDeps(), now);
      if (result.success) console.log(`League ${leagueId}: season auto-ended (${result.seasonId})`);
      return result.success;
    },
  };
}
