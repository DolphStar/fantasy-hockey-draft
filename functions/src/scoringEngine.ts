// Fantasy scoring engine for Cloud Functions - uses Firebase Admin SDK
import * as admin from 'firebase-admin';
import {
    getCompletedGamesYesterday,
    getGameBoxscore,
    getGamePlayByPlay,
    getAllPlayersFromBoxscore,
    countFightsFromPlayByPlay,
    type PlayerGameStats,
} from './nhlStats';

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
 * Calculate fantasy points for a skater
 */
function calculateSkaterPoints(
    stats: PlayerGameStats,
    rules: ScoringRules,
    isDefenseman: boolean
): number {
    let points = 0;

    points += (stats.goals || 0) * rules.goal;
    points += (stats.assists || 0) * rules.assist;
    points += (stats.shortHandedGoals || 0) * rules.shortHandedGoal;

    // Use actual fight count from play-by-play data (not PIM/5)
    points += (stats.fights || 0) * rules.fight;

    if (isDefenseman) {
        points += (stats.blockedShots || 0) * rules.blockedShot;
        points += (stats.hits || 0) * rules.hit;
    }

    return points;
}

/**
 * Calculate fantasy points for a goalie
 */
function calculateGoaliePoints(
    stats: PlayerGameStats,
    rules: ScoringRules
): number {
    let points = 0;

    points += (stats.wins || 0) * rules.win;
    points += (stats.shutouts || 0) * rules.shutout;
    points += (stats.saves || 0) * rules.save;
    points += (stats.assists || 0) * rules.goalieAssist;
    points += (stats.goals || 0) * rules.goalieGoal;

    return points;
}

/**
 * Calculate fantasy points for any player
 */
export function calculatePlayerPoints(
    stats: PlayerGameStats,
    rules: ScoringRules
): number {
    const isGoalie = stats.position === 'G';
    const isDefenseman = stats.position === 'D';

    if (isGoalie) {
        return calculateGoaliePoints(stats, rules);
    } else {
        return calculateSkaterPoints(stats, rules, isDefenseman);
    }
}

/**
 * Process yesterday's games and update team scores for a specific league
 */
export async function processYesterdayScores(leagueId: string): Promise<void> {
    const db = admin.firestore();

    try {
        console.log(`[${leagueId}] Starting score processing`);

        // Calculate yesterday's date in Eastern Time
        const now = new Date();
        const etOffset = -5; // EST is UTC-5
        const etTime = new Date(now.getTime() + (etOffset * 60 * 60 * 1000));
        etTime.setDate(etTime.getDate() - 1);
        const year = etTime.getUTCFullYear();
        const month = String(etTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(etTime.getUTCDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

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

        // Get yesterday's completed games
        const gameIds = await getCompletedGamesYesterday();
        console.log(`[${leagueId}] Processing ${gameIds.length} completed games`);

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
                } catch (error) {
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
            } catch (error) {
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
