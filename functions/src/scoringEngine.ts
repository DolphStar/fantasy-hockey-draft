// Fantasy scoring engine for Cloud Functions - uses Firebase Admin SDK
import * as admin from 'firebase-admin';
import {
    getGamesForDate,
    getGameBoxscore,
    getGamePlayByPlay,
    getAllPlayersFromBoxscore,
    countFightsFromPlayByPlay,
} from './nhlStats';
import { getPreviousNewYorkDateString } from './dateUtils';
import { calculatePlayerPoints } from './scoringMath';

interface ScoringRules {
    goal: number;
    assist: number;
    shortHandedGoal: number;
    overtimeGoal: number;
    fight: number;
    blockedShot: number;
    hit: number;
    win: number;
    shutout: number;
    save: number;
    goalieAssist: number;
    goalieGoal: number;
    goalieFight: number;
}

export interface TeamScore {
    teamName: string;
    totalPoints: number;
    wins: number;
    losses: number;
    lastUpdated: string;
}

export interface PlayerDailyScore {
    playerId: number;
    playerName: string;
    teamName: string;
    nhlTeam: string;
    date: string;
    points: number;
    stats: Record<string, number>;
}

/**
 * Process yesterday's games and update team scores for a specific league
 */
export async function processYesterdayScores(leagueId: string): Promise<void> {
    const db = admin.firestore();

    try {
        console.log(`[${leagueId}] Starting score processing`);

        const dateStr = getPreviousNewYorkDateString();

        console.log(`[${leagueId}] Processing games for date: ${dateStr} (ET)`);

        // Check if date already processed
        const processedDateRef = db.doc(`leagues/${leagueId}/processedDates/${dateStr}`);
        const processedDateSnap = await processedDateRef.get();

        if (processedDateSnap.exists) {
            console.log(`[${leagueId}] Date ${dateStr} already processed, skipping`);
            return;
        }

        // Get league document
        const leagueDoc = await db.doc(`leagues/${leagueId}`).get();
        if (!leagueDoc.exists) {
            throw new Error(`League ${leagueId} not found`);
        }

        const leagueData = leagueDoc.data();
        const scoringRules = leagueData?.scoringRules as ScoringRules;

        // Check if league is active
        if (leagueData?.status !== 'live') {
            console.log(`[${leagueId}] League not active (status: ${leagueData?.status}), skipping`);
            return;
        }

        if (!scoringRules) {
            throw new Error(`League ${leagueId} missing scoring rules`);
        }

        // Get all drafted players (active roster only)
        const draftedPlayersSnap = await db.collection('draftedPlayers')
            .where('leagueId', '==', leagueId)
            .where('rosterSlot', '==', 'active')
            .get();

        const playerToTeamMap = new Map<number, string>();
        draftedPlayersSnap.docs.forEach((doc) => {
            const data = doc.data();
            playerToTeamMap.set(data.playerId, data.draftedByTeam);
        });

        console.log(`[${leagueId}] Found ${playerToTeamMap.size} active roster players`);

        // Get yesterday's completed games (filtered by allowed game types)
        const allowedGameTypes: number[] = leagueData?.allowedGameTypes || [2]; // Default: regular season only
        const allGames = await getGamesForDate(dateStr);
        const completedGames = allGames.filter(
            (g) => (g.gameState === 'OFF' || g.gameState === 'FINAL') &&
                   allowedGameTypes.includes(g.gameType)
        );
        const skippedByType = allGames.filter(
            (g) => (g.gameState === 'OFF' || g.gameState === 'FINAL') &&
                   !allowedGameTypes.includes(g.gameType)
        );
        if (skippedByType.length > 0) {
            console.log(`[${leagueId}] ⚠️ Skipped ${skippedByType.length} games with non-allowed gameType (allowed: ${allowedGameTypes.join(',')})`);
        }
        const gameIds = completedGames.map((g) => g.id);
        console.log(`[${leagueId}] Processing ${gameIds.length} completed games (allowed gameTypes: ${allowedGameTypes.join(',')})`);

        // Track points by team
        const teamPoints = new Map<string, number>();
        const playerScores: PlayerDailyScore[] = [];

        // Process each game
        for (const gameId of gameIds) {
            try {
                const boxscore = await getGameBoxscore(gameId);
                const allPlayers = getAllPlayersFromBoxscore(boxscore);

                // Fetch play-by-play to get actual fight counts
                let fightCounts = new Map<number, number>();
                try {
                    const playByPlay = await getGamePlayByPlay(gameId);
                    fightCounts = countFightsFromPlayByPlay(playByPlay);
                    if (fightCounts.size > 0) {
                        console.log(`[${leagueId}] Game ${gameId}: Found ${fightCounts.size} players with fights`);
                    }
                } catch {
                    console.warn(`[${leagueId}] Could not fetch play-by-play for game ${gameId}, skipping fight scoring`);
                }

                // Calculate points for drafted players
                for (const playerStats of allPlayers) {
                    const fantasyTeam = playerToTeamMap.get(playerStats.playerId);

                    if (fantasyTeam) {
                        // Add actual fight count to player stats
                        const fights = fightCounts.get(playerStats.playerId) || 0;
                        playerStats.fights = fights;

                        const points = calculatePlayerPoints(playerStats, scoringRules);

                        if (isNaN(points) || !isFinite(points)) {
                            console.warn(`[${leagueId}] Invalid points for ${playerStats.name.default}`);
                            continue;
                        }

                        const currentPoints = teamPoints.get(fantasyTeam) || 0;
                        teamPoints.set(fantasyTeam, currentPoints + points);

                        if (points > 0) {
                            const stats: Record<string, number> = {};
                            if (playerStats.goals !== undefined) stats.goals = playerStats.goals;
                            if (playerStats.assists !== undefined) stats.assists = playerStats.assists;
                            if (playerStats.shots !== undefined) stats.shots = playerStats.shots;
                            if (playerStats.hits !== undefined) stats.hits = playerStats.hits;
                            if (playerStats.blockedShots !== undefined) stats.blockedShots = playerStats.blockedShots;
                            if (playerStats.pim !== undefined) stats.pim = playerStats.pim;
                            if (playerStats.fights !== undefined && playerStats.fights > 0) stats.fights = playerStats.fights;
                            if (playerStats.wins !== undefined) stats.wins = playerStats.wins;
                            if (playerStats.saves !== undefined) stats.saves = playerStats.saves;
                            if (playerStats.shutouts !== undefined) stats.shutouts = playerStats.shutouts;

                            playerScores.push({
                                playerId: playerStats.playerId,
                                playerName: playerStats.name.default,
                                teamName: fantasyTeam,
                                nhlTeam: playerStats.teamAbbrev || 'UNK',
                                date: dateStr,
                                points,
                                stats,
                            });

                            console.log(`[${leagueId}] ${playerStats.name.default} (${fantasyTeam}): ${points.toFixed(2)} pts`);
                        }
                    }
                }
            } catch (error) {
                console.error(`[${leagueId}] Error processing game ${gameId}:`, error);
            }
        }

        // Update team scores
        for (const [teamName, points] of teamPoints.entries()) {
            if (isNaN(points) || !isFinite(points)) {
                console.warn(`[${leagueId}] Skipping ${teamName}: invalid points`);
                continue;
            }

            const teamScoreRef = db.doc(`leagues/${leagueId}/teamScores/${teamName}`);

            try {
                await teamScoreRef.update({
                    totalPoints: admin.firestore.FieldValue.increment(points),
                    lastUpdated: new Date().toISOString(),
                });
            } catch {
                // Document doesn't exist, create it
                await teamScoreRef.set({
                    teamName,
                    totalPoints: points,
                    wins: 0,
                    losses: 0,
                    lastUpdated: new Date().toISOString(),
                });
            }

            console.log(`[${leagueId}] Updated ${teamName}: +${points.toFixed(2)} points`);
        }

        // Save player daily scores
        for (const playerScore of playerScores) {
            const scoreId = `${playerScore.playerId}-${dateStr}`;
            const scoreRef = db.doc(`leagues/${leagueId}/playerDailyScores/${scoreId}`);
            await scoreRef.set(playerScore);
        }

        // Mark date as processed
        await processedDateRef.set({
            date: dateStr,
            processedAt: new Date().toISOString(),
            gamesProcessed: gameIds.length,
            teamsUpdated: teamPoints.size,
            playerPerformances: playerScores.length,
        });

        console.log(`[${leagueId}] ✅ Score processing complete! Updated ${teamPoints.size} teams with ${playerScores.length} player performances`);
    } catch (error) {
        console.error(`[${leagueId}] Error in processYesterdayScores:`, error);
        throw error;
    }
}
