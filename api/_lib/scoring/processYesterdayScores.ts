/**
 * Daily fantasy scoring for a league (aligned with `src/utils/scoringEngine` + Admin SDK).
 */

import { FieldValue } from 'firebase-admin/firestore';

import { getPreviousNewYorkDateString } from '../../../packages/core/dates/dateUtils.js';
import { aggregateDailyScores } from '../../../packages/core/scoring/aggregateDailyScores.js';
import type { PlayerGameStats } from '../../../packages/core/nhl/types.js';
import type { ScoringRules } from '../../../packages/core/scoring/types.js';

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

    const playersByGame: PlayerGameStats[][] = [];

    for (const gameId of gameIds) {
      try {
        const boxscore = await getGameBoxscore(gameId);
        const playByPlay = await getGamePlayByPlay(gameId);
        const fightCounts = countFightsFromPlayByPlay(playByPlay);

        const allPlayers = getAllPlayersFromBoxscore(boxscore);
        allPlayers.forEach((p) => {
          p.fights = fightCounts.get(p.playerId) || 0;
        });

        playersByGame.push(allPlayers);
      } catch (error) {
        console.error(`Error processing game ${gameId}:`, error);
      }
    }

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

    for (const playerScore of playerScores) {
      const scoreId = `${playerScore.playerId}-${dateStr}`;
      const scoreRef = db.doc(`leagues/${leagueId}/playerDailyScores/${scoreId}`);
      await scoreRef.set(playerScore);
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
