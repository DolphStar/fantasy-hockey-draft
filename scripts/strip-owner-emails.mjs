#!/usr/bin/env node

/**
 * Remove the `ownerEmail` field from every league's teams array. League docs
 * are readable by any signed-in user (public browse), so emails must not live
 * there (audit finding S1).
 *
 * Usage:
 *   node scripts/strip-owner-emails.mjs            # Dry run
 *   node scripts/strip-owner-emails.mjs --commit   # Execute
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const commitMode = process.argv.includes('--commit');

if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  console.error('Error: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is required.');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)) });
const db = getFirestore();

async function main() {
  console.log(`\n=== Strip ownerEmail from league teams (${commitMode ? 'COMMIT' : 'DRY RUN'}) ===\n`);

  const leaguesSnap = await db.collection('leagues').get();
  let changed = 0;

  for (const leagueDoc of leaguesSnap.docs) {
    const teams = leagueDoc.data().teams ?? [];
    const hasEmails = teams.some((t) => 'ownerEmail' in t);
    if (!hasEmails) continue;

    const cleaned = teams.map(({ ownerEmail: _dropped, ...rest }) => rest);
    console.log(`League ${leagueDoc.id}: stripping ownerEmail from ${teams.length} team entries`);
    if (commitMode) {
      await leagueDoc.ref.update({ teams: cleaned, updatedAt: new Date().toISOString() });
    }
    changed++;
  }

  console.log(`\n${commitMode ? 'Updated' : 'Would update'} ${changed} league docs.`);
  if (!commitMode) console.log('Run with --commit to execute.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
