#!/usr/bin/env node

/**
 * Remove Olympic Points Backfill Script
 *
 * Removes all fantasy points that were incorrectly awarded from Olympic games
 * during the NHL's Olympic break (Feb 11-22, 2026).
 *
 * Usage:
 *   node scripts/remove-olympic-points.mjs --league-id <LEAGUE_ID>           # Dry run (default)
 *   node scripts/remove-olympic-points.mjs --league-id <LEAGUE_ID> --commit  # Actually execute
 *
 * Environment:
 *   FIREBASE_SERVICE_ACCOUNT_KEY - JSON string of Firebase service account credentials
 *   DEFAULT_LEAGUE_ID - Fallback league ID if --league-id not provided
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// --- Configuration ---
const OLYMPIC_START = '2026-02-11';
const OLYMPIC_END = '2026-02-22';

// --- Parse CLI args ---
const args = process.argv.slice(2);
const commitMode = args.includes('--commit');
const leagueIdFlag = args.indexOf('--league-id');
const leagueId = leagueIdFlag !== -1 ? args[leagueIdFlag + 1] : process.env.DEFAULT_LEAGUE_ID;

if (!leagueId) {
  console.error('Error: No league ID provided.');
  console.error('Usage: node scripts/remove-olympic-points.mjs --league-id <LEAGUE_ID> [--commit]');
  process.exit(1);
}

// --- Initialize Firebase Admin ---
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountKey) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required.');
  console.error('Set it to the JSON string of your Firebase service account credentials.');
  process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountKey);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// --- Generate date range ---
function getDateRange(start, end) {
  const dates = [];
  const current = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');

  while (current <= endDate) {
    const yyyy = current.getUTCFullYear();
    const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

// --- Main ---
async function main() {
  const mode = commitMode ? 'COMMIT' : 'DRY RUN';
  console.log(`\n=== Remove Olympic Points (${mode}) ===`);
  console.log(`League: ${leagueId}`);
  console.log(`Date range: ${OLYMPIC_START} to ${OLYMPIC_END}`);
  console.log('');

  const olympicDates = getDateRange(OLYMPIC_START, OLYMPIC_END);
  console.log(`Checking ${olympicDates.length} dates: ${olympicDates.join(', ')}\n`);

  // Track totals
  const teamPointsToRemove = new Map(); // teamName -> total points to subtract
  let totalPlayerScoreDocs = 0;
  let totalProcessedDateDocs = 0;
  let totalLiveStatsDocs = 0;

  // 1. Find all playerDailyScores in the Olympic date range
  console.log('--- Scanning playerDailyScores ---');
  for (const dateStr of olympicDates) {
    const scoresRef = db.collection(`leagues/${leagueId}/playerDailyScores`);
    const snapshot = await scoresRef.where('date', '==', dateStr).get();

    if (snapshot.empty) {
      console.log(`  ${dateStr}: No scores found`);
      continue;
    }

    console.log(`  ${dateStr}: Found ${snapshot.size} player score(s)`);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const points = data.points || 0;
      const teamName = data.teamName;

      console.log(`    - ${data.playerName} (${teamName}): ${points.toFixed(2)} pts [${doc.id}]`);

      // Accumulate points to remove per team
      const current = teamPointsToRemove.get(teamName) || 0;
      teamPointsToRemove.set(teamName, current + points);
      totalPlayerScoreDocs++;
    }
  }

  // 2. Find processedDates in the range
  console.log('\n--- Scanning processedDates ---');
  for (const dateStr of olympicDates) {
    const processedRef = db.doc(`leagues/${leagueId}/processedDates/${dateStr}`);
    const processedSnap = await processedRef.get();

    if (processedSnap.exists) {
      const data = processedSnap.data();
      console.log(`  ${dateStr}: Processed (${data.gamesProcessed} games, ${data.playerPerformances} performances)`);
      totalProcessedDateDocs++;
    }
  }

  // 3. Find liveStats in the range
  console.log('\n--- Scanning liveStats ---');
  for (const dateStr of olympicDates) {
    const liveStatsRef = db.collection(`leagues/${leagueId}/liveStats`);
    // liveStats doc IDs are formatted as {dateKey}_{playerId}
    const snapshot = await liveStatsRef
      .where('dateKey', '==', dateStr)
      .get();

    if (!snapshot.empty) {
      console.log(`  ${dateStr}: Found ${snapshot.size} live stat(s)`);
      totalLiveStatsDocs += snapshot.size;
    }
  }

  // --- Summary ---
  console.log('\n=== SUMMARY ===');
  console.log(`Player daily scores to delete: ${totalPlayerScoreDocs}`);
  console.log(`Processed date markers to delete: ${totalProcessedDateDocs}`);
  console.log(`Live stats to delete: ${totalLiveStatsDocs}`);
  console.log('');

  if (teamPointsToRemove.size > 0) {
    console.log('Points to subtract per team:');
    for (const [teamName, points] of teamPointsToRemove.entries()) {
      console.log(`  ${teamName}: -${points.toFixed(2)} pts`);
    }
  } else {
    console.log('No Olympic points found to remove.');
    return;
  }

  if (!commitMode) {
    console.log('\n--- DRY RUN complete. No changes made. ---');
    console.log('Run with --commit to execute changes.');
    return;
  }

  // --- Execute changes ---
  console.log('\n--- COMMITTING changes ---');

  // 4a. Delete playerDailyScores (chunked to respect Firestore 500-op batch limit)
  console.log('\nDeleting playerDailyScores...');
  for (const dateStr of olympicDates) {
    const scoresRef = db.collection(`leagues/${leagueId}/playerDailyScores`);
    const snapshot = await scoresRef.where('date', '==', dateStr).get();

    if (!snapshot.empty) {
      for (let i = 0; i < snapshot.docs.length; i += 500) {
        const batch = db.batch();
        snapshot.docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      console.log(`  Deleted ${snapshot.size} scores for ${dateStr}`);
    }
  }

  // 4b. Subtract points from teamScores
  console.log('\nUpdating team scores...');
  for (const [teamName, pointsToRemove] of teamPointsToRemove.entries()) {
    const teamScoreRef = db.doc(`leagues/${leagueId}/teamScores/${teamName}`);
    const teamSnap = await teamScoreRef.get();

    if (teamSnap.exists) {
      const currentTotal = teamSnap.data().totalPoints || 0;
      const newTotal = currentTotal - pointsToRemove;
      await teamScoreRef.update({
        totalPoints: FieldValue.increment(-pointsToRemove),
        lastUpdated: new Date().toISOString(),
      });
      console.log(`  ${teamName}: ${currentTotal.toFixed(2)} -> ${newTotal.toFixed(2)} (-${pointsToRemove.toFixed(2)})`);
    } else {
      console.log(`  ${teamName}: Team score doc not found (skipping)`);
    }
  }

  // 4c. Delete processedDates
  console.log('\nDeleting processedDates...');
  for (const dateStr of olympicDates) {
    const processedRef = db.doc(`leagues/${leagueId}/processedDates/${dateStr}`);
    const processedSnap = await processedRef.get();
    if (processedSnap.exists) {
      await processedRef.delete();
      console.log(`  Deleted processedDate for ${dateStr}`);
    }
  }

  // 4d. Delete liveStats
  console.log('\nDeleting liveStats...');
  for (const dateStr of olympicDates) {
    const liveStatsRef = db.collection(`leagues/${leagueId}/liveStats`);
    const snapshot = await liveStatsRef.where('dateKey', '==', dateStr).get();

    if (!snapshot.empty) {
      for (let i = 0; i < snapshot.docs.length; i += 500) {
        const batch = db.batch();
        snapshot.docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      console.log(`  Deleted ${snapshot.size} live stats for ${dateStr}`);
    }
  }

  console.log('\n=== DONE. Olympic points removed successfully. ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
