#!/usr/bin/env node

/**
 * Full-season rescore: clears a league's scores and re-runs daily scoring for
 * every previously processed date through the DEPLOYED /api/calculate-scores
 * endpoint (so the fixed engine is exercised, not a local copy).
 *
 * Usage:
 *   node scripts/rescore-season.mjs --league-id <LEAGUE_ID>            # Dry run (default)
 *   node scripts/rescore-season.mjs --league-id <LEAGUE_ID> --commit   # Actually execute
 *
 * Environment:
 *   FIREBASE_SERVICE_ACCOUNT_KEY - JSON string of Firebase service account credentials
 *   CRON_SECRET                  - the deployed app's cron secret
 *   BASE_URL                     - deployed app origin (default https://fantasy-hockey-draft.vercel.app)
 *
 * IMPORTANT: deploy the scoring fix BEFORE running with --commit.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const commitMode = args.includes('--commit');
const leagueIdFlag = args.indexOf('--league-id');
const leagueId = leagueIdFlag !== -1 ? args[leagueIdFlag + 1] : undefined;
const baseUrl = process.env.BASE_URL || 'https://fantasy-hockey-draft.vercel.app';
const cronSecret = process.env.CRON_SECRET;

if (!leagueId) {
  console.error('Usage: node scripts/rescore-season.mjs --league-id <LEAGUE_ID> [--commit]');
  process.exit(1);
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required.');
  process.exit(1);
}
if (commitMode && !cronSecret) {
  console.error('Error: CRON_SECRET is required in --commit mode.');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
const db = getFirestore();

async function deleteCollectionChunked(path) {
  const snapshot = await db.collection(path).get();
  for (let i = 0; i < snapshot.docs.length; i += 500) {
    const batch = db.batch();
    snapshot.docs.slice(i, i + 500).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  return snapshot.size;
}

async function main() {
  console.log(`\n=== Full-season rescore (${commitMode ? 'COMMIT' : 'DRY RUN'}) ===`);
  console.log(`League: ${leagueId}`);
  console.log(`Endpoint: ${baseUrl}/api/calculate-scores\n`);

  const processedSnap = await db.collection(`leagues/${leagueId}/processedDates`).get();
  const dates = processedSnap.docs.map((d) => d.id).sort();
  if (dates.length === 0) {
    console.log('No processed dates found — nothing to rescore.');
    return;
  }
  console.log(`Processed dates: ${dates.length} (${dates[0]} .. ${dates[dates.length - 1]})`);

  const teamScoresSnap = await db.collection(`leagues/${leagueId}/teamScores`).get();
  console.log('\nCurrent team totals (before):');
  for (const doc of teamScoresSnap.docs) {
    console.log(`  ${doc.id}: ${(doc.data().totalPoints ?? 0).toFixed(2)}`);
  }

  if (!commitMode) {
    console.log('\n--- DRY RUN complete. Run with --commit to clear and rescore. ---');
    return;
  }

  console.log('\n--- Clearing existing scores ---');
  for (const sub of ['playerDailyScores', 'teamScores', 'aggregates', 'processedDates']) {
    const n = await deleteCollectionChunked(`leagues/${leagueId}/${sub}`);
    console.log(`  Deleted ${n} docs from ${sub}`);
  }

  console.log('\n--- Rescoring each date (oldest first) ---');
  let ok = 0;
  const failures = [];
  for (const date of dates) {
    const url = `${baseUrl}/api/calculate-scores?leagueId=${encodeURIComponent(leagueId)}&date=${date}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${cronSecret}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || body.message || `HTTP ${res.status}`);
      const result = body.results?.[0];
      console.log(`  ${date}: ${result?.status ?? 'ok'} (${result?.playerPerformances ?? 0} performances)`);
      ok++;
    } catch (err) {
      console.error(`  ${date}: FAILED — ${err.message}`);
      failures.push(date);
    }
    await new Promise((r) => setTimeout(r, 1000)); // be gentle to NHL API + Vercel
  }

  console.log(`\nRescored ${ok}/${dates.length} dates.`);
  if (failures.length) {
    console.log(`Failed dates (re-run individually via Test Scoring or this script): ${failures.join(', ')}`);
  }

  const afterSnap = await db.collection(`leagues/${leagueId}/teamScores`).get();
  console.log('\nNew team totals (after):');
  for (const doc of afterSnap.docs) {
    console.log(`  ${doc.id}: ${(doc.data().totalPoints ?? 0).toFixed(2)}`);
  }
  console.log('\n=== DONE ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
