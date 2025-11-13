// Fantasy scoring engine - calculates points based on player stats and league rules

import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, updateDoc, increment, query, where } from 'firebase/firestore';
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
  stats: {
    goals?: number;
    assists?: number;
    shots?: number;
    hits?: number;
    blockedShots?: number;
    wins?: number;
    saves?: number;
    shutouts?: number;
  };
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
  
  // Goals and assists
  points += stats.goals * rules.goal;
  points += stats.assists * rules.assist;
  
  // Short-handed goals (bonus on top of regular goal)
  points += stats.shortHandedGoals * rules.shortHandedGoal;
  
  // Defense-specific stats
  if (isDefenseman) {
    points += stats.blockedShots * rules.blockedShot;
    points += stats.hits * rules.hit;
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
  
  // Wins and shutouts
  if (stats.wins) points += stats.wins * rules.win;
  if (stats.shutouts) points += stats.shutouts * rules.shutout;
  
  // Saves
  if (stats.saves) points += stats.saves * rules.save;
  
  // Goalie assists and goals (rare but possible!)
  if (stats.assists) points += stats.assists * rules.goalieAssist;
  if (stats.goals) points += stats.goals * rules.goalieGoal;
  
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
    
    // 1. Get league document to fetch scoring rules
    const leagueDoc = await getDocs(query(collection(db, 'leagues'), where('__name__', '==', leagueId)));
    if (leagueDoc.empty) {
      throw new Error(`League ${leagueId} not found`);
    }
    
    const leagueData = leagueDoc.docs[0].data();
    const scoringRules = leagueData.scoringRules as ScoringRules;
    
    // 2. Get all drafted players for this league
    const draftedPlayersQuery = query(
      collection(db, 'draftedPlayers'),
      where('leagueId', '==', leagueId)
    );
    const draftedPlayersSnapshot = await getDocs(draftedPlayersQuery);
    
    // Create a map of NHL player ID → fantasy team name
    const playerToTeamMap = new Map<number, string>();
    draftedPlayersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      playerToTeamMap.set(data.playerId, data.draftedByTeam);
    });
    
    console.log(`Found ${playerToTeamMap.size} drafted players in league ${leagueId}`);
    
    // 3. Get yesterday's completed games
    const gameIds = await getCompletedGamesYesterday();
    console.log(`Processing ${gameIds.length} completed games`);
    
    // 4. Track points by team
    const teamPoints = new Map<string, number>();
    const playerScores: PlayerDailyScore[] = [];
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    // 5. Process each game
    for (const gameId of gameIds) {
      try {
        const boxscore = await getGameBoxscore(gameId);
        const allPlayers = getAllPlayersFromBoxscore(boxscore);
        
        // 6. Calculate points for drafted players who played
        for (const playerStats of allPlayers) {
          const fantasyTeam = playerToTeamMap.get(playerStats.playerId);
          
          if (fantasyTeam) {
            // This player is on someone's fantasy team!
            const points = calculatePlayerPoints(playerStats, scoringRules);
            
            // Add to team total
            const currentPoints = teamPoints.get(fantasyTeam) || 0;
            teamPoints.set(fantasyTeam, currentPoints + points);
            
            // Track player daily score
            playerScores.push({
              playerId: playerStats.playerId,
              playerName: playerStats.name,
              teamName: fantasyTeam,
              nhlTeam: playerStats.teamAbbrev,
              date: dateStr,
              points,
              stats: {
                goals: playerStats.goals,
                assists: playerStats.assists,
                shots: playerStats.shots,
                hits: playerStats.hits,
                blockedShots: playerStats.blockedShots,
                wins: playerStats.wins,
                saves: playerStats.saves,
                shutouts: playerStats.shutouts,
              },
            });
            
            console.log(`${playerStats.name} (${fantasyTeam}): ${points.toFixed(2)} pts`);
          }
        }
      } catch (error) {
        console.error(`Error processing game ${gameId}:`, error);
        // Continue with other games
      }
    }
    
    // 7. Update team scores in Firestore
    for (const [teamName, points] of teamPoints.entries()) {
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
    
    console.log(`Score processing complete! Updated ${teamPoints.size} teams with ${playerScores.length} player performances`);
    
  } catch (error) {
    console.error('Error in processYesterdayScores:', error);
    throw error;
  }
}
