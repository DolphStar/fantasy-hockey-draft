// Live stats tracking for today's games
// Updates multiple times per day to show real-time performance

import { db } from '../firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { getGamesForDate, getGameBoxscore, getAllPlayersFromBoxscore } from './nhlStats';

export interface LivePlayerStats {
  playerId: number;
  playerName: string;
  teamName: string; // Fantasy team name
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
  lastUpdated: any; // Firestore timestamp
  dateKey: string; // YYYY-MM-DD of the actual game date
}

/**
 * Process live stats for today's games
 * Should be called multiple times per day (every 10-15 minutes)
 */
export async function processLiveStats(leagueId: string) {
  try {
    console.log('🔴 LIVE STATS: Starting live stats update...');

    // Check if league is active (not still drafting)
    const { doc: firestoreDoc, getDoc } = await import('firebase/firestore');
    const leagueDoc = await getDoc(firestoreDoc(db, 'leagues', leagueId));
    const league = leagueDoc.data();

    if (!league || league.status !== 'live') {
      console.log(`🔴 LIVE STATS: League is not active yet (status: ${league?.status}). Skipping live stats.`);
      return { success: false, gamesProcessed: 0, playersUpdated: 0, message: 'League not active' };
    }

    // Get today's date in Eastern Time (NHL's timezone)
    // Convert current time to ET (UTC-5 or UTC-4 depending on DST)
    const now = new Date();
    const etOffset = -5; // EST is UTC-5 (adjust to -4 for EDT if needed)
    const etTime = new Date(now.getTime() + (etOffset * 60 * 60 * 1000));
    const year = etTime.getUTCFullYear();
    const month = String(etTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(etTime.getUTCDate()).padStart(2, '0');
    const etDateStr = `${year}-${month}-${day}`;

    console.log(`🔴 LIVE STATS: Using ET date: ${etDateStr}`);
    console.log(`🔴 LIVE STATS: ET time: ${etTime.toUTCString()}`);

    // 1. Get today's games
    const todayGames = await getGamesForDate(etDateStr);

    // Also get yesterday's games (in case some FINAL games are still there)
    const yesterday = new Date(etTime.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`;
    const yesterdayGames = await getGamesForDate(yesterdayStr);

    const yesterdayFinals = yesterdayGames.filter(g => g.gameState === 'FINAL' || g.gameState === 'OFF');
    // Combine with explicit metadata so we know which entries belong to which day
    const gameEntries = [
      ...todayGames.map(game => ({ game, dateKey: etDateStr, isPreviousDay: false })),
      ...yesterdayFinals.map(game => ({ game, dateKey: yesterdayStr, isPreviousDay: true })),
    ];

    console.log(`🔴 LIVE STATS: Found ${todayGames.length} today's games + ${yesterdayFinals.length} yesterday's FINAL games`);

    if (gameEntries.length === 0) {
      console.log('🔴 LIVE STATS: No games to process');
      return { success: true, gamesProcessed: 0, playersUpdated: 0 };
    }

    console.log(` LIVE STATS: Tracking ${gameEntries.length} games for processing`);

    // 2. Get all drafted players for this league
    const draftedPlayersRef = collection(db, 'draftedPlayers');
    const { getDocs, query, where, limit } = await import('firebase/firestore');
    const draftedQuery = query(draftedPlayersRef, where('leagueId', '==', leagueId));
    const draftedSnapshot = await getDocs(draftedQuery);

    // Map player ID -> fantasy team
    const playerToTeamMap = new Map<number, string>();
    draftedSnapshot.forEach(doc => {
      const data = doc.data();
      playerToTeamMap.set(data.playerId, data.draftedByTeam);
    });

    console.log(` LIVE STATS: Tracking ${playerToTeamMap.size} drafted players`);

    // 3. Process each game (with delay to avoid rate limiting)
    let gamesProcessed = 0;
    let playersUpdated = 0;

    const liveStatsCollection = collection(db, `leagues/${leagueId}/liveStats`);

    for (let i = 0; i < gameEntries.length; i++) {
      const { game, dateKey: gameDateKey, isPreviousDay: isPreviousDayGame } = gameEntries[i];

      const existingStatsQuery = query(
        liveStatsCollection,
        where('gameId', '==', game.id),
        limit(1)
      );
      const existingStatsSnapshot = await getDocs(existingStatsQuery);
      const existingStat = existingStatsSnapshot.docs[0]?.data() as LivePlayerStats | undefined;

      if (isPreviousDayGame && !existingStat) {
        console.log(` LIVE STATS: Skipping previous-day game ${game.id} with no existing stats`);
        continue;
      }

      try {
        // Skip future games - no stats yet
        if (game.gameState === 'FUT') {
          console.log(` LIVE STATS: Game ${game.id} not started yet (${game.gameState})`);
          continue;
        }

        console.log(` LIVE STATS: Processing game ${game.id} (${game.gameState})`);
        console.log(` LIVE STATS: API scores - Away: ${game.awayTeam?.score}, Home: ${game.homeTeam?.score}`);

        // 1. Start with what the API gave us
        const apiAwayScore = game.awayTeam.score || 0;
        const apiHomeScore = game.homeTeam.score || 0;
        let awayScore = apiAwayScore;
        let homeScore = apiHomeScore;

        // 2. THE FIX: If API says 0-0, check if we have better data in Firestore
        // This prevents the "blip" from overwriting real scores
        if (apiAwayScore === 0 && apiHomeScore === 0 && existingStat) {
          if (existingStat.awayScore > 0 || existingStat.homeScore > 0) {
            console.warn(`⚠️ API returned 0-0 for Game ${game.id}, preserving existing score: ${existingStat.awayScore}-${existingStat.homeScore}`);
            awayScore = existingStat.awayScore;
            homeScore = existingStat.homeScore;
          }
        }

        // 3. Handle FINAL games
        const isFinal = game.gameState === 'FINAL' || game.gameState === 'OFF';
        if (isFinal && existingStat) {
          // Check if existing stats have 0 points - if so, we need to re-fetch
          const hasZeroPoints = existingStat.goals === 0 && existingStat.assists === 0;
          
          // If API has different scores (e.g., OT goal) we must update
          if (apiAwayScore !== existingStat.awayScore || apiHomeScore !== existingStat.homeScore) {
            console.warn(`🔄 FINAL game ${game.id} score changed: ${existingStat.awayScore}-${existingStat.homeScore} → ${apiAwayScore}-${apiHomeScore}`);
            awayScore = apiAwayScore;
            homeScore = apiHomeScore;
            // Continue processing to update
          } else if (hasZeroPoints) {
            // Re-fetch if we have 0 points - might have been fetched before game data was ready
            console.log(`🔄 LIVE STATS: Re-fetching FINAL game ${game.id} - existing stats show 0 points`);
          } else if (apiAwayScore > 0 || apiHomeScore > 0) {
            console.log(`✓ LIVE STATS: Skipping FINAL game ${game.id} with unchanged scores: ${apiAwayScore}-${apiHomeScore}`);
            continue;
          }
        } else if (isFinal && !existingStat) {
          // Final game with no existing stats - need to fetch it!
          console.log(`🔄 LIVE STATS: Fetching FINAL game ${game.id} - no existing stats`);
        }

        // Add delay between API calls to avoid rate limiting (500ms)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Fetch boxscore
        const boxscore = await getGameBoxscore(game.id);
        const allPlayers = getAllPlayersFromBoxscore(boxscore);

        console.log(` LIVE STATS: Using scores for game ${game.id}: ${awayScore}-${homeScore}`);

        // 4. Prepare batch writes for all players in this game
        const { writeBatch } = await import('firebase/firestore');
        const batch = writeBatch(db);
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
              fights: Math.floor((playerStats.pim || 0) / 5), // 5 PIM = 1 fight
              wins: playerStats.wins || 0,
              saves: playerStats.saves || 0,
              shutouts: playerStats.shutouts || 0,
              lastUpdated: serverTimestamp(),
              dateKey: gameDateKey,
            };

            const liveStatsRef = doc(db, `leagues/${leagueId}/liveStats`, `${gameDateKey}_${playerStats.playerId}`);
            batch.set(liveStatsRef, liveStats);
            batchCount++;

            console.log(`🔴 ${playerStats.name.default} (${fantasyTeam}): ${liveStats.goals}G ${liveStats.assists}A [${game.gameState}]`);
          }
        }

        // Commit all players for this game at once
        if (batchCount > 0) {
          await batch.commit();
          playersUpdated += batchCount;
          console.log(` LIVE STATS: Batch committed ${batchCount} players for game ${game.id}`);
        }

        gamesProcessed++;
      } catch (error) {
        console.error(`🔴 LIVE STATS: Error processing game ${game.id}:`, error);
        // Continue with other games
      }
    }

    console.log(`🔴 LIVE STATS: Complete! Processed ${gamesProcessed} games, updated ${playersUpdated} players`);

    return { success: true, gamesProcessed, playersUpdated };
  } catch (error) {
    console.error('🔴 LIVE STATS: Error processing live stats:', error);
    throw error;
  }
}

/**
 * Get live stats summary for display
 * Returns stats grouped by team
 */
export async function getLiveStatsSummary(leagueId: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const liveStatsRef = collection(db, `leagues/${leagueId}/liveStats`);
    const { getDocs } = await import('firebase/firestore');

    // Get all live stats for today
    const snapshot = await getDocs(liveStatsRef);
    const liveStats: LivePlayerStats[] = [];

    snapshot.forEach(doc => {
      const data = doc.data() as LivePlayerStats;
      // Only include today's stats
      if (doc.id.startsWith(today)) {
        liveStats.push(data);
      }
    });

    // Group by team
    const teamStats = new Map<string, {
      players: LivePlayerStats[];
      totalGoals: number;
      totalAssists: number;
      totalPoints: number;
    }>();

    liveStats.forEach(stat => {
      const existing = teamStats.get(stat.teamName) || {
        players: [],
        totalGoals: 0,
        totalAssists: 0,
        totalPoints: 0,
      };

      existing.players.push(stat);
      existing.totalGoals += stat.goals;
      existing.totalAssists += stat.assists;
      existing.totalPoints += stat.points;

      teamStats.set(stat.teamName, existing);
    });

    return teamStats;
  } catch (error) {
    console.error('Error fetching live stats summary:', error);
    throw error;
  }
}
