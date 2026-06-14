/**
 * Daily fantasy scoring for a league (aligned with `src/utils/scoringEngine` + Admin SDK).
 */

import { FieldValue } from 'firebase-admin/firestore';

import { getPreviousNewYorkDateString } from '../../../packages/core/dates/dateUtils.js';
import { aggregateDailyScores } from '../../../packages/core/scoring/aggregateDailyScores.js';
import type { AggregatedPlayerScore } from '../../../packages/core/scoring/aggregateDailyScores.js';
import {
  buildTeamAggregate,
  foldDailyScores,
} from '../../../packages/core/scoring/seasonAggregate.js';
import type { TeamSeasonAggregate } from '../../../packages/core/scoring/seasonAggregate.js';
import type { PlayerGameStats } from '../../../packages/core/nhl/types.js';
import type { ScoringRules } from '../../../packages/core/scoring/types.js';

import { mapWithConcurrency } from '../concurrency.js';
import { getAdminDb } from '../firebaseAdmin.js';
import {
  getAllPlayersFromBoxscore,
  getGameBoxscore,
  getGamePlayByPlay,
  getGamesForDate,
} from '../nhl/webClient.js';
import {
  buildActivePlayerToTeamMap,
  filterCompletedGamesForScoring,
} from './helpers.js';

const GAME_FETCH_CONCURRENCY = 4;
const BATCH_LIMIT = 500;

export interface TeamScore {
  teamName: string;
  totalPoints: number;
  wins: number;
  losses: number;
  lastUpdated: string;
}

function countFightsFromPlayByPlay(playByPlay: unknown): Map<number, number> {
  const fightCounts = new Map<number, number>();

  try {
    const plays = (playByPlay as { plays?: unknown[] })?.plays || [];

    for (const play of plays) {
      const p = play as {
        typeDescKey?: string;
        details?: { descKey?: string; committedByPlayerId?: number };
      };
      if (p.typeDescKey === 'penalty') {
        const details = p.details;
        if (details?.descKey === 'fighting') {
          const playerId = details.committedByPlayerId;
          if (playerId) {
            fightCounts.set(playerId, (fightCounts.get(playerId) || 0) + 1);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing play-by-play for fights:', error);
  }

  return fightCounts;
}

export async function processYesterdayScores(
  leagueId: string,
  targetDate?: string,
): Promise<void> {
  try {
    console.log(`Starting score processing for league: ${leagueId}`);

    let dateStr = targetDate;

    if (!dateStr) {
      dateStr = getPreviousNewYorkDateString();
    }

    console.log(`Processing games for date: ${dateStr} (ET timezone)`);

    const db = await getAdminDb();

    const processedDateRef = db.doc(`leagues/${leagueId}/processedDates/${dateStr}`);
    const processedDateSnap = await processedDateRef.get();

    if (processedDateSnap.exists) {
      console.log(
        `⚠️ Date ${dateStr} has already been processed for league ${leagueId}. Skipping to prevent duplicate scoring.`,
      );
      throw new Error(
        `Date ${dateStr} has already been scored. Use "Clear Scores" first if you need to re-calculate.`,
      );
    }

    const leagueRef = db.doc(`leagues/${leagueId}`);
    const leagueSnap = await leagueRef.get();
    if (!leagueSnap.exists) {
      throw new Error(`League ${leagueId} not found`);
    }

    const leagueData = leagueSnap.data()!;
    const scoringRules = leagueData.scoringRules as ScoringRules | undefined;

    if (leagueData.status !== 'live') {
      console.log(
        `⚠️ League is not active yet (status: ${leagueData.status}). Skipping scoring.`,
      );
      throw new Error(
        `League is not active (status: ${leagueData.status}). Complete the draft first before scoring begins.`,
      );
    }

    if (!scoringRules) {
      throw new Error(
        `League ${leagueId} does not have scoring rules configured. Please update the league with scoring rules first.`,
      );
    }

    const draftedPlayersSnapshot = await db
      .collection('draftedPlayers')
      .where('leagueId', '==', leagueId)
      .get();

    const rows = draftedPlayersSnapshot.docs.map((d) => d.data());
    const { playerToTeamMap, reserveCount } = buildActivePlayerToTeamMap(rows);

    console.log(
      `Found ${playerToTeamMap.size} active roster players in league ${leagueId} (${reserveCount} reserve players excluded from scoring)`,
    );

    const allowedGameTypes: number[] = leagueData.allowedGameTypes || [2];
    const games = await getGamesForDate(dateStr);
    const { completedGames, skippedByType } = filterCompletedGamesForScoring(
      games,
      allowedGameTypes,
    );

    if (skippedByType.length > 0) {
      console.log(
        `⚠️ Skipped ${skippedByType.length} games with non-allowed gameType (allowed: ${allowedGameTypes.join(',')}): ${skippedByType.map((g) => `${g.id} (type=${g.gameType})`).join(', ')}`,
      );
    }

    const gameIds = completedGames.map((g) => g.id);
    console.log(
      `Processing ${gameIds.length} completed games (allowed gameTypes: ${allowedGameTypes.join(',')})`,
    );

    const playersByGame = (
      await mapWithConcurrency(gameIds, GAME_FETCH_CONCURRENCY, async (gameId) => {
        try {
          const boxscore = await getGameBoxscore(gameId);
          const playByPlay = await getGamePlayByPlay(gameId);
          const fightCounts = countFightsFromPlayByPlay(playByPlay);

          const allPlayers = getAllPlayersFromBoxscore(boxscore);
          allPlayers.forEach((p) => {
            p.fights = fightCounts.get(p.playerId) || 0;
          });
          return allPlayers;
        } catch (error) {
          console.error(`Error processing game ${gameId}:`, error);
          return [] as PlayerGameStats[];
        }
      })
    ).filter((players) => players.length > 0);

    const { teamPoints, playerScores } = aggregateDailyScores(
      playersByGame,
      playerToTeamMap,
      scoringRules,
      dateStr,
    );

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

      console.log(`Updated ${teamName}: +${points.toFixed(2)} points`);
    }

    for (let i = 0; i < playerScores.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const playerScore of playerScores.slice(i, i + BATCH_LIMIT)) {
        const scoreRef = db.doc(
          `leagues/${leagueId}/playerDailyScores/${playerScore.playerId}-${dateStr}`,
        );
        batch.set(scoreRef, playerScore);
      }
      await batch.commit();
    }

    // Maintain per-team season aggregates so the dashboard reads one doc
    // instead of scanning the whole playerDailyScores collection (audit F4).
    // playerScores are already written above, so a bootstrap scan sees today.
    const aggregatesCol = db.collection(`leagues/${leagueId}/aggregates`);

    const scoresByTeam = new Map<string, AggregatedPlayerScore[]>();
    for (const score of playerScores) {
      const list = scoresByTeam.get(score.teamName) ?? [];
      list.push(score);
      scoresByTeam.set(score.teamName, list);
    }

    const anyAggregate = await aggregatesCol.limit(1).get();
    if (anyAggregate.empty) {
      console.log('No season aggregates found — bootstrapping from full scan');
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
      console.log(`Bootstrapped ${allByTeam.size} team aggregates`);
    } else {
      // Incremental: fold today's scores into each team's existing aggregate.
      // A team with no doc yet had no prior scores (bootstrap covers every team
      // that ever scored), so starting from null here is correct.
      for (const [teamName, scores] of scoresByTeam) {
        const ref = aggregatesCol.doc(teamName);
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          const prev = snap.exists ? (snap.data() as TeamSeasonAggregate) : null;
          const next = foldDailyScores(prev, teamName, scores);
          tx.set(ref, { ...next, lastUpdated: new Date().toISOString() });
        });
      }
      console.log(`Updated ${scoresByTeam.size} team aggregates incrementally`);
    }

    await processedDateRef.set({
      date: dateStr,
      processedAt: new Date().toISOString(),
      gamesProcessed: gameIds.length,
      teamsUpdated: teamPoints.size,
      playerPerformances: playerScores.length,
    });
    console.log(`✅ Marked ${dateStr} as processed to prevent duplicate scoring`);

    console.log(
      `Score processing complete! Updated ${teamPoints.size} teams with ${playerScores.length} player performances`,
    );
  } catch (error) {
    console.error('Error in processYesterdayScores:', error);
    throw error;
  }
}
