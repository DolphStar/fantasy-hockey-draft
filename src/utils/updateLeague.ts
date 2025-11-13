// Utility to update existing leagues with new fields
// Run this once in browser console to add scoring rules to existing leagues

import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

// Default scoring rules
export const DEFAULT_SCORING_RULES = {
  // Skaters
  goal: 1,
  assist: 1,
  shortHandedGoal: 1,
  overtimeGoal: 1,
  fight: 2,
  // Defense
  blockedShot: 0.15,
  hit: 0.1,
  // Goalies
  win: 1,
  shutout: 2,
  save: 0.04,
  goalieAssist: 1,
  goalieGoal: 20,
  goalieFight: 5,
};

// Default roster settings: 9F / 6D / 2G / 5 reserves
export const DEFAULT_ROSTER_SETTINGS = {
  forwards: 9,
  defensemen: 6,
  goalies: 2,
  reserves: 5,
};

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
