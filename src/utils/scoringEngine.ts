// Fantasy scoring engine - calculates points based on player stats and league rules

import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, increment, query, where } from 'firebase/firestore';
import type { ScoringRules } from '../types/league';
import type { PlayerGameStats } from './nhlStats';
import { getCompletedGamesYesterday, getGameBoxscore, getAllPlayersFromBoxscore } from './nhlStats';

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
  teamName: string; // Fantasy team name
  nhlTeam: string;
  date: string;
  points: number;
  stats: Record<string, number>; // Dynamic stats object (only includes defined values)
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
  
  // Goals and assists (default to 0 if undefined)
  points += (stats.goals || 0) * rules.goal;
  points += (stats.assists || 0) * rules.assist;
  
  // Short-handed goals (bonus on top of regular goal)
  points += (stats.shortHandedGoals || 0) * rules.shortHandedGoal;
  
  // Defense-specific stats
  if (isDefenseman) {
    points += (stats.blockedShots || 0) * rules.blockedShot;
    points += (stats.hits || 0) * rules.hit;
  }
  
  // Note: Fight and overtime goal detection would require more detailed game data
  // These would need to be tracked separately via NHL play-by-play data
  
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
  
  // Wins and shutouts (default to 0 if undefined)
  points += (stats.wins || 0) * rules.win;
  points += (stats.shutouts || 0) * rules.shutout;
  
  // Saves
  points += (stats.saves || 0) * rules.save;
  
  // Goalie assists and goals (rare but possible!)
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
 * Process yesterday's games and update team scores
 * This is the main scoring function that should be run daily
 */
export async function processYesterdayScores(leagueId: string): Promise<void> {
  try {
    console.log(`Starting score processing for league: ${leagueId}`);
    
    // Calculate yesterday's date string
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    // 0. Check if this date has already been processed (idempotency check)
    const processedDateRef = doc(db, `leagues/${leagueId}/processedDates`, dateStr);
    const processedDateSnap = await getDoc(processedDateRef);
    
    if (processedDateSnap.exists()) {
      console.log(`⚠️ Date ${dateStr} has already been processed for league ${leagueId}. Skipping to prevent duplicate scoring.`);
      throw new Error(`Date ${dateStr} has already been scored. Use "Clear Scores" first if you need to re-calculate.`);
    }
    
    // 1. Get league document to fetch scoring rules
    const leagueDoc = await getDocs(query(collection(db, 'leagues'), where('__name__', '==', leagueId)));
    if (leagueDoc.empty) {
      throw new Error(`League ${leagueId} not found`);
    }
    
    const leagueData = leagueDoc.docs[0].data();
    const scoringRules = leagueData.scoringRules as ScoringRules;
    
    // Check if league is active (not still drafting)
    if (leagueData.status !== 'live') {
      console.log(`⚠️ League is not active yet (status: ${leagueData.status}). Skipping scoring.`);
      throw new Error(`League is not active (status: ${leagueData.status}). Complete the draft first before scoring begins.`);
    }
    
    if (!scoringRules) {
      throw new Error(`League ${leagueId} does not have scoring rules configured. Please update the league with scoring rules first.`);
    }
    
    // 2. Get all drafted players for this league
    const draftedPlayersQuery = query(
      collection(db, 'draftedPlayers'),
      where('leagueId', '==', leagueId)
    );
    const draftedPlayersSnapshot = await getDocs(draftedPlayersQuery);
    
    // Create a map of NHL player ID → fantasy team name
    // IMPORTANT: Only count ACTIVE roster players, not reserves!
    const playerToTeamMap = new Map<number, string>();
    let reserveCount = 0;
    draftedPlayersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Only include players in active roster slots
      if (data.rosterSlot === 'active') {
        playerToTeamMap.set(data.playerId, data.draftedByTeam);
      } else {
        reserveCount++;
      }
    });
    
    console.log(`Found ${playerToTeamMap.size} active roster players in league ${leagueId} (${reserveCount} reserve players excluded from scoring)`);
    
    // 3. Get yesterday's completed games
    const gameIds = await getCompletedGamesYesterday();
    console.log(`Processing ${gameIds.length} completed games`);
    
    // 4. Track points by team
    const teamPoints = new Map<string, number>();
    const playerScores: PlayerDailyScore[] = [];
    
    console.log('DEBUG: Drafted player IDs:', Array.from(playerToTeamMap.keys()).slice(0, 5));
    
    // 5. Process each game
    for (const gameId of gameIds) {
      try {
        const boxscore = await getGameBoxscore(gameId);
        const allPlayers = getAllPlayersFromBoxscore(boxscore);
        
        console.log(`DEBUG: Game ${gameId} has ${allPlayers.length} players`);
        if (allPlayers.length > 0) {
          console.log('DEBUG: Sample player from game:', {
            id: allPlayers[0].playerId,
            name: allPlayers[0].name.default,
            position: allPlayers[0].position,
            goals: allPlayers[0].goals,
            assists: allPlayers[0].assists
          });
        }
        
        // 6. Calculate points for drafted players who played
        for (const playerStats of allPlayers) {
          const fantasyTeam = playerToTeamMap.get(playerStats.playerId);
          
          if (fantasyTeam) {
            // This player is on someone's fantasy team!
            const points = calculatePlayerPoints(playerStats, scoringRules);
            
            // Skip if points are invalid
            if (isNaN(points) || !isFinite(points)) {
              console.warn(`${playerStats.name.default} (${fantasyTeam}): Invalid points (${points}) - skipping`);
              continue;
            }
            
            // Add to team total (ensure currentPoints is valid too)
            const currentPoints = teamPoints.get(fantasyTeam) || 0;
            const newTotal = currentPoints + points;
            
            // Double-check the new total is valid
            if (isNaN(newTotal) || !isFinite(newTotal)) {
              console.error(`Invalid team total for ${fantasyTeam}: ${currentPoints} + ${points} = ${newTotal}`);
              continue;
            }
            
            teamPoints.set(fantasyTeam, newTotal);
            
            // Only save player daily score if they scored points
            if (points > 0) {
              // Track player daily score (filter out undefined values for Firebase)
              const stats: Record<string, number> = {};
              if (playerStats.goals !== undefined) stats.goals = playerStats.goals;
              if (playerStats.assists !== undefined) stats.assists = playerStats.assists;
              if (playerStats.shots !== undefined) stats.shots = playerStats.shots;
              if (playerStats.hits !== undefined) stats.hits = playerStats.hits;
              if (playerStats.blockedShots !== undefined) stats.blockedShots = playerStats.blockedShots;
              if (playerStats.wins !== undefined) stats.wins = playerStats.wins;
              if (playerStats.saves !== undefined) stats.saves = playerStats.saves;
              if (playerStats.shutouts !== undefined) stats.shutouts = playerStats.shutouts;
              
              playerScores.push({
                playerId: playerStats.playerId,
                playerName: playerStats.name.default,
                teamName: fantasyTeam,
                nhlTeam: playerStats.teamAbbrev || 'UNK', // Should be set by getAllPlayersFromBoxscore
                date: dateStr,
                points,
                stats,
              });
              
              console.log(`${playerStats.name.default} (${fantasyTeam}): ${points.toFixed(2)} pts`);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing game ${gameId}:`, error);
        // Continue with other games
      }
    }
    
    // 7. Update team scores in Firestore
    console.log('DEBUG: Team points before update:', Array.from(teamPoints.entries()));
    
    for (const [teamName, points] of teamPoints.entries()) {
      // Skip if points are invalid
      if (isNaN(points) || !isFinite(points)) {
        console.warn(`Skipping ${teamName}: invalid points (${points})`);
        continue;
      }
      
      const teamScoreRef = doc(db, `leagues/${leagueId}/teamScores`, teamName);
      
      try {
        await updateDoc(teamScoreRef, {
          totalPoints: increment(points),
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        // Document might not exist, create it
        await setDoc(teamScoreRef, {
          teamName,
          totalPoints: points,
          wins: 0,
          losses: 0,
          lastUpdated: new Date().toISOString(),
        });
      }
      
      console.log(`Updated ${teamName}: +${points.toFixed(2)} points`);
    }
    
    // 8. Save player daily scores for history/debugging
    for (const playerScore of playerScores) {
      const scoreId = `${playerScore.playerId}-${dateStr}`;
      const scoreRef = doc(db, `leagues/${leagueId}/playerDailyScores`, scoreId);
      
      await setDoc(scoreRef, playerScore);
    }
    
    // 9. Mark this date as processed (prevents duplicate scoring)
    await setDoc(processedDateRef, {
      date: dateStr,
      processedAt: new Date().toISOString(),
      gamesProcessed: gameIds.length,
      teamsUpdated: teamPoints.size,
      playerPerformances: playerScores.length
    });
    console.log(`✅ Marked ${dateStr} as processed to prevent duplicate scoring`);
    
    console.log(`Score processing complete! Updated ${teamPoints.size} teams with ${playerScores.length} player performances`);
    
  } catch (error) {
    console.error('Error in processYesterdayScores:', error);
    throw error;
  }
}
