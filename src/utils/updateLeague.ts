// Utility to update existing leagues with new fields
// Run this once in browser console to add scoring rules to existing leagues

import { DEFAULT_ROSTER_SETTINGS, DEFAULT_SCORING_RULES } from '../constants/scoring';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

/**
 * Update a league to add scoring rules and roster settings
 * Use this for leagues created before the scoring system was added
 */
export async function addScoringRulesToLeague(leagueId: string) {
  try {
    const leagueRef = doc(db, 'leagues', leagueId);
    
    await updateDoc(leagueRef, {
      scoringRules: DEFAULT_SCORING_RULES,
      rosterSettings: DEFAULT_ROSTER_SETTINGS,
      updatedAt: new Date().toISOString(),
    });
    
    console.log(`✅ Successfully added scoring rules to league: ${leagueId}`);
    return true;
  } catch (error) {
    console.error('Error updating league:', error);
    throw error;
  }
}

// Helper to run in console
(window as any).addScoringRulesToLeague = addScoringRulesToLeague;
