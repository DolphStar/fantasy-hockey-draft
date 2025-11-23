// NHL Stats API utilities for Cloud Functions (uses axios instead of fetch)
import axios from 'axios';

const BASE_URL = 'https://api-web.nhle.com/v1';

export interface GameScore {
    id: number;
    season: number;
    gameType: number;
    gameDate: string;
    awayTeam: {
        id: number;
        abbrev: string;
        score: number;
    };
    homeTeam: {
        id: number;
        abbrev: string;
        score: number;
    };
    gameState: string;
    gameOutcome: {
        lastPeriodType: string;
    };
}

export interface PlayerGameStats {
    playerId: number;
    name: {
        default: string;
    };
    teamAbbrev?: string;
    position: string;
    sweaterNumber?: number;
    goals?: number;
    assists?: number;
    points?: number;
    plusMinus?: number;
    powerPlayGoals?: number;
    shortHandedGoals?: number;
    shots?: number;
    hits?: number;
    blockedShots?: number;
    pim?: number;
    fights?: number; // Actual fighting penalties (added by countFightsFromPlayByPlay)
    faceoffWinningPctg?: number;
    toi?: string;
    // Goalie stats
    wins?: number;
    losses?: number;
    otLosses?: number;
    saves?: number;
    goalsAgainst?: number;
    shutouts?: number;
    savePctg?: number;
}

export interface Boxscore {
    gameId: number;
    awayTeam?: {
        abbrev?: string;
    };
    homeTeam?: {
        abbrev?: string;
    };
    playerByGameStats: {
        awayTeam: {
            forwards: PlayerGameStats[];
            defense: PlayerGameStats[];
            goalies: PlayerGameStats[];
        };
        homeTeam: {
            forwards: PlayerGameStats[];
            defense: PlayerGameStats[];
            goalies: PlayerGameStats[];
        };
    };
}

/**
 * Fetch all games for a specific date
 */
export async function getGamesForDate(date?: string): Promise<GameScore[]> {
    try {
        // Default to yesterday's date
        if (!date) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            date = yesterday.toISOString().split('T')[0];
        }

        const response = await axios.get(`${BASE_URL}/score/${date}`);
        console.log(`NHL Stats: Found ${response.data.games?.length || 0} games for ${date}`);

        return response.data.games || [];
    } catch (error) {
        console.error('Error fetching games:', error);
        throw error;
    }
}

/**
 * Fetch boxscore (player stats) for a specific game
 */
export async function getGameBoxscore(gameId: number): Promise<Boxscore> {
    try {
        const response = await axios.get(`${BASE_URL}/gamecenter/${gameId}/boxscore`);
        console.log(`NHL Stats: Fetched boxscore for game ${gameId}`);

        return response.data;
    } catch (error) {
        console.error(`Error fetching boxscore for game ${gameId}:`, error);
        throw error;
    }
}

/**
 * Fetch play-by-play data for a game to get penalty details
 */
export async function getGamePlayByPlay(gameId: number): Promise<any> {
    try {
        const response = await axios.get(`${BASE_URL}/gamecenter/${gameId}/play-by-play`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching play-by-play for game ${gameId}:`, error);
        throw error;
    }
}

/**
 * Count actual fights from play-by-play data
 * Returns a map of playerId -> fight count
 */
export function countFightsFromPlayByPlay(playByPlay: any): Map<number, number> {
    const fightCounts = new Map<number, number>();

    try {
        const plays = playByPlay?.plays || [];

        for (const play of plays) {
            // Look for penalty plays
            if (play.typeDescKey === 'penalty') {
                const details = play.details;

                // Fighting major is typically 5 minutes with descKey "fighting"
                if (details?.descKey === 'fighting') {
                    const playerId = details?.committedByPlayerId;
                    if (playerId) {
                        const currentCount = fightCounts.get(playerId) || 0;
                        fightCounts.set(playerId, currentCount + 1);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error parsing play-by-play for fights:', error);
    }

    return fightCounts;
}

/**
 * Get all completed games from yesterday
 */
export async function getCompletedGamesYesterday(): Promise<number[]> {
    try {
        const games = await getGamesForDate();

        // Filter for completed games only
        const completedGames = games.filter(
            (game) => game.gameState === 'OFF' || game.gameState === 'FINAL'
        );

        console.log(`NHL Stats: ${completedGames.length} completed games yesterday`);

        return completedGames.map((game) => game.id);
    } catch (error) {
        console.error('Error getting completed games:', error);
        throw error;
    }
}

/**
 * Get all player stats from a boxscore
 */
export function getAllPlayersFromBoxscore(boxscore: Boxscore): PlayerGameStats[] {
    const players: PlayerGameStats[] = [];

    if (!boxscore.playerByGameStats) {
        return players;
    }

    const { awayTeam, homeTeam } = boxscore.playerByGameStats;
    const awayTeamAbbrev = boxscore.awayTeam?.abbrev || 'UNK';
    const homeTeamAbbrev = boxscore.homeTeam?.abbrev || 'UNK';

    // Collect all away team players
    if (awayTeam) {
        const awayPlayers = [
            ...(awayTeam.forwards || []),
            ...(awayTeam.defense || []),
            ...(awayTeam.goalies || []),
        ];
        awayPlayers.forEach((player) => {
            player.teamAbbrev = awayTeamAbbrev;
        });
        players.push(...awayPlayers);
    }

    // Collect all home team players
    if (homeTeam) {
        const homePlayers = [
            ...(homeTeam.forwards || []),
            ...(homeTeam.defense || []),
            ...(homeTeam.goalies || []),
        ];
        homePlayers.forEach((player) => {
            player.teamAbbrev = homeTeamAbbrev;
        });
        players.push(...homePlayers);
    }

    return players;
}
