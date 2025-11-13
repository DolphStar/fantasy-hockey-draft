// Utility to clear old scores (useful when testing or fixing data issues)
// Run in browser console to clear NaN or incorrect scores

import { db } from '../firebase';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';

/**
 * Clear all team scores and player daily scores for a league
 * Useful for resetting after data structure changes or bugs
 */
export async function clearAllScores(leagueId: string) {
  try {
    console.log(`Starting to clear scores for league: ${leagueId}`);
    
    // Clear team scores
    const teamScoresRef = collection(db, `leagues/${leagueId}/teamScores`);
    const teamScoresDocs = await getDocs(teamScoresRef);
    let teamCount = 0;
    
    for (const docSnapshot of teamScoresDocs.docs) {
      await deleteDoc(docSnapshot.ref);
      teamCount++;
    }
    
    console.log(`✅ Deleted ${teamCount} team score documents`);
    
    // Clear player daily scores
    const playerScoresRef = collection(db, `leagues/${leagueId}/playerDailyScores`);
    const playerScoresDocs = await getDocs(playerScoresRef);
    let playerCount = 0;
    
    for (const docSnapshot of playerScoresDocs.docs) {
      await deleteDoc(docSnapshot.ref);
      playerCount++;
    }
    
    console.log(`✅ Deleted ${playerCount} player daily score documents`);
    console.log(`✅ All scores cleared! Run scoring again to recalculate.`);
    
    return { teamCount, playerCount };
  } catch (error) {
    console.error('❌ Error clearing scores:', error);
    throw error;
  }
}

// Make it available in browser console
(window as any).clearAllScores = clearAllScores;
