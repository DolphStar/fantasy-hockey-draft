/**
 * Server-side live stats update (Admin SDK + NHL web API).
 * Behavior aligned with legacy `src/utils/liveStats` `processLiveStats`.
 */

import { FieldValue } from 'firebase-admin/firestore';

import { getHockeyDay, getPreviousNewYorkDateString } from '../../../packages/core/dates/dateUtils.js';

import { getAdminDb } from '../firebaseAdmin.js';
import { getAllPlayersFromBoxscore, getGameBoxscore, getGamesForDate } from '../nhl/webClient.js';
import {
  type LiveStatSnapshot,
  resolveLiveGameDisplayScores,
  shouldSkipPreviousDayFinalWithoutStoredSample,
} from './helpers.js';

export interface LivePlayerStats {
  playerId: number;
  playerName: string;
  teamName: string;
  nhlTeam: string;
  gameId: number;
  gameState: string;
  awayScore: number;
  homeScore: number;
  period: number;
  clock: string;
  goals: number;
  assists: number;
  points: number;
  shots: number;
  hits: number;
  blockedShots: number;
  fights: number;
  wins: number;
  saves: number;
  shutouts: number;
  lastUpdated: ReturnType<typeof FieldValue.serverTimestamp>;
  dateKey: string;
}

export interface ProcessLiveStatsResult {
  success: boolean;
  gamesProcessed: number;
  playersUpdated: number;
  message?: string;
}

function toSnapshot(data: Record<string, unknown> | undefined): LiveStatSnapshot | undefined {
  if (!data) return undefined;
  return {
    awayScore: Number(data.awayScore) || 0,
    homeScore: Number(data.homeScore) || 0,
    goals: Number(data.goals) || 0,
    assists: Number(data.assists) || 0,
  };
}

export async function processLiveStats(leagueId: string): Promise<ProcessLiveStatsResult> {
  console.log('🔴 LIVE STATS: Starting live stats update...');

  const db = await getAdminDb();
  const leagueSnap = await db.doc(`leagues/${leagueId}`).get();
  const league = leagueSnap.data();

  if (!league || league.status !== 'live') {
    console.log(
      `🔴 LIVE STATS: League is not active yet (status: ${league?.status}). Skipping live stats.`,
    );
    return { success: false, gamesProcessed: 0, playersUpdated: 0, message: 'League not active' };
  }

  const now = new Date();
  const etDateStr = getHockeyDay(now);
  console.log(`🔴 LIVE STATS: Using hockey day date: ${etDateStr}`);

  const allowedGameTypes: number[] = league.allowedGameTypes || [2];
  const todayGamesRaw = await getGamesForDate(etDateStr);
  const todayGames = todayGamesRaw.filter((g) => allowedGameTypes.includes(g.gameType));
  if (todayGamesRaw.length !== todayGames.length) {
    console.log(
      `🔴 LIVE STATS: Filtered out ${todayGamesRaw.length - todayGames.length} games with non-allowed gameType (allowed: ${allowedGameTypes.join(',')})`,
    );
  }

  const yesterdayStr = getPreviousNewYorkDateString(now);
  const yesterdayGamesRaw =
    yesterdayStr === etDateStr ? [] : await getGamesForDate(yesterdayStr);
  const yesterdayGamesFiltered = yesterdayGamesRaw.filter((g) =>
    allowedGameTypes.includes(g.gameType),
  );

  const yesterdayFinals = yesterdayGamesFiltered.filter(
    (g) => g.gameState === 'FINAL' || g.gameState === 'OFF',
  );

  const gameEntries = [
    ...todayGames.map((game) => ({ game, dateKey: etDateStr, isPreviousDay: false as const })),
    ...yesterdayFinals.map((game) => ({
      game,
      dateKey: yesterdayStr,
      isPreviousDay: true as const,
    })),
  ];

  console.log(
    `🔴 LIVE STATS: Found ${todayGames.length} today's games + ${yesterdayFinals.length} yesterday's FINAL games`,
  );

  if (gameEntries.length === 0) {
    console.log('🔴 LIVE STATS: No games to process');
    return { success: true, gamesProcessed: 0, playersUpdated: 0 };
  }

  console.log(` LIVE STATS: Tracking ${gameEntries.length} games for processing`);

  const draftedSnap = await db.collection('draftedPlayers').where('leagueId', '==', leagueId).get();

  const playerToTeamMap = new Map<number, string>();
  draftedSnap.forEach((d) => {
    const data = d.data();
    playerToTeamMap.set(data.playerId, data.draftedByTeam);
  });

  console.log(` LIVE STATS: Tracking ${playerToTeamMap.size} drafted players`);

  const liveStatsCollectionPath = `leagues/${leagueId}/liveStats`;
  let gamesProcessed = 0;
  let playersUpdated = 0;

  for (let i = 0; i < gameEntries.length; i++) {
    const { game, dateKey: gameDateKey, isPreviousDay: isPreviousDayGame } = gameEntries[i];

    const existingStatsSnap = await db
      .collection(liveStatsCollectionPath)
      .where('gameId', '==', game.id)
      .limit(1)
      .get();
    const existingStatDoc = existingStatsSnap.docs[0];
    const existingStat = toSnapshot(existingStatDoc?.data() as Record<string, unknown> | undefined);

    if (
      shouldSkipPreviousDayFinalWithoutStoredSample({
        isPreviousDayGame,
        hasExistingLiveDoc: !!existingStatDoc,
      })
    ) {
      console.log(` LIVE STATS: Skipping previous-day game ${game.id} with no existing stats`);
      continue;
    }

    try {
      if (game.gameState === 'FUT') {
        console.log(` LIVE STATS: Game ${game.id} not started yet (${game.gameState})`);
        continue;
      }

      console.log(` LIVE STATS: Processing game ${game.id} (${game.gameState})`);
      console.log(
        ` LIVE STATS: API scores - Away: ${game.awayTeam?.score}, Home: ${game.homeTeam?.score}`,
      );

      const apiAwayScore = game.awayTeam.score || 0;
      const apiHomeScore = game.homeTeam.score || 0;

      const { awayScore, homeScore, skipRestOfGame } = resolveLiveGameDisplayScores(
        game.gameState,
        apiAwayScore,
        apiHomeScore,
        existingStat,
      );

      if (skipRestOfGame) {
        console.log(
          `✓ LIVE STATS: Skipping FINAL game ${game.id} with unchanged scores: ${apiAwayScore}-${apiHomeScore}`,
        );
        continue;
      }

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const boxscore = await getGameBoxscore(game.id);
      const allPlayers = getAllPlayersFromBoxscore(boxscore);

      console.log(` LIVE STATS: Using scores for game ${game.id}: ${awayScore}-${homeScore}`);

      const batch = db.batch();
      let batchCount = 0;

      for (const playerStats of allPlayers) {
        const fantasyTeam = playerToTeamMap.get(playerStats.playerId);

        if (fantasyTeam) {
          const liveStats: LivePlayerStats = {
            playerId: playerStats.playerId,
            playerName: playerStats.name.default,
            teamName: fantasyTeam,
            nhlTeam: playerStats.teamAbbrev || 'UNK',
            gameId: game.id,
            gameState: game.gameState,
            awayScore,
            homeScore,
            period: 0,
            clock: '',
            goals: playerStats.goals || 0,
            assists: playerStats.assists || 0,
            points: (playerStats.goals || 0) + (playerStats.assists || 0),
            shots: playerStats.shots || 0,
            hits: playerStats.hits || 0,
            blockedShots: playerStats.blockedShots || 0,
            fights: Math.floor((playerStats.pim || 0) / 5),
            wins: playerStats.wins || 0,
            saves: playerStats.saves || 0,
            shutouts: playerStats.shutouts || 0,
            lastUpdated: FieldValue.serverTimestamp(),
            dateKey: gameDateKey,
          };

          const liveStatsRef = db.doc(`${liveStatsCollectionPath}/${gameDateKey}_${playerStats.playerId}`);
          batch.set(liveStatsRef, liveStats);
          batchCount++;

          console.log(
            `🔴 ${playerStats.name.default} (${fantasyTeam}): ${liveStats.goals}G ${liveStats.assists}A [${game.gameState}]`,
          );
        }
      }

      if (batchCount > 0) {
        await batch.commit();
        playersUpdated += batchCount;
        console.log(` LIVE STATS: Batch committed ${batchCount} players for game ${game.id}`);
      }

      gamesProcessed++;
    } catch (error) {
      console.error(`🔴 LIVE STATS: Error processing game ${game.id}:`, error);
    }
  }

  console.log(
    `🔴 LIVE STATS: Complete! Processed ${gamesProcessed} games, updated ${playersUpdated} players`,
  );

  return { success: true, gamesProcessed, playersUpdated };
}
