// Live stats tracking for today's games
// Updates multiple times per day to show real-time performance

import { db } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
  wins: number;
  saves: number;
  shutouts: number;
  lastUpdated: any; // Firestore timestamp
}

/**
 * Process live stats for today's games
 * Should be called multiple times per day (every 10-15 minutes)
 */
export async function processLiveStats(leagueId: string) {
  try {
    console.log('🔴 LIVE STATS: Starting live stats update...');
    
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
    
    // 1. Get all games scheduled for today
    const games = await getGamesForDate(etDateStr);
    
    if (games.length === 0) {
      console.log('🔴 LIVE STATS: No games today');
      return { success: true, gamesProcessed: 0, playersUpdated: 0 };
    }
    
    console.log(`🔴 LIVE STATS: Found ${games.length} games today`);
    
    // 2. Get all drafted players for this league
    const draftedPlayersRef = collection(db, 'draftedPlayers');
    const { getDocs, query, where } = await import('firebase/firestore');
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
    
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      
      try {
        // Only process games that are live or completed today
        // Skip future games (FUT) - no stats yet
        if (game.gameState === 'FUT') {
          console.log(` LIVE STATS: Game ${game.id} not started yet (${game.gameState})`);
          continue;
        }
        
        console.log(` LIVE STATS: Processing game ${game.id} (${game.gameState})`);
        
        // Add delay between API calls to avoid rate limiting (500ms)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Fetch boxscore
        const boxscore = await getGameBoxscore(game.id);
        const allPlayers = getAllPlayersFromBoxscore(boxscore);
        
        // 4. Update live stats for drafted players in this game
        for (const playerStats of allPlayers) {
          const fantasyTeam = playerToTeamMap.get(playerStats.playerId);
          
          if (fantasyTeam) {
            // This player is on someone's fantasy team!
            const liveStats: LivePlayerStats = {
              playerId: playerStats.playerId,
              playerName: playerStats.name.default,
              teamName: fantasyTeam,
              nhlTeam: playerStats.teamAbbrev || 'UNK',
              gameId: game.id,
              gameState: game.gameState,
              awayScore: game.awayTeam.score || 0,
              homeScore: game.homeTeam.score || 0,
              period: 0, // Period info not available in GameScore API
              clock: '', // Clock info not available in GameScore API
              goals: playerStats.goals || 0,
              assists: playerStats.assists || 0,
              points: (playerStats.goals || 0) + (playerStats.assists || 0),
              shots: playerStats.shots || 0,
              hits: playerStats.hits || 0,
              blockedShots: playerStats.blockedShots || 0,
              wins: playerStats.wins || 0,
              saves: playerStats.saves || 0,
              shutouts: playerStats.shutouts || 0,
              lastUpdated: serverTimestamp(),
            };
            
            // Save to Firestore (upsert)
            const liveStatsRef = doc(
              db,
              `leagues/${leagueId}/liveStats`,
              `${etDateStr}_${playerStats.playerId}`
            );
            
            await setDoc(liveStatsRef, liveStats);
            playersUpdated++;
            
            console.log(`🔴 ${playerStats.name.default} (${fantasyTeam}): ${liveStats.goals}G ${liveStats.assists}A [${game.gameState}]`);
          }
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
