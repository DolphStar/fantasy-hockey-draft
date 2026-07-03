#!/usr/bin/env node

/**
 * Backfill `ownerUid` on draftedPlayers docs from each league's teams array.
 * Required before deploying the firestore.rules that gate roster-slot updates
 * on ownerUid — without the backfill, members lose their own roster moves.
 *
 * Usage:
 *   node scripts/backfill-drafted-owner.mjs            # Dry run
 *   node scripts/backfill-drafted-owner.mjs --commit   # Execute
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
  console.log(`\n=== Backfill draftedPlayers.ownerUid (${commitMode ? 'COMMIT' : 'DRY RUN'}) ===\n`);

  const leaguesSnap = await db.collection('leagues').get();
  let totalUpdated = 0;

  for (const leagueDoc of leaguesSnap.docs) {
    const teams = leagueDoc.data().teams ?? [];
    const ownerByTeam = new Map(teams.map((t) => [t.teamName, t.ownerUid ?? '']));

    const playersSnap = await db
      .collection('draftedPlayers')
      .where('leagueId', '==', leagueDoc.id)
      .get();

    const updates = [];
    for (const playerDoc of playersSnap.docs) {
      const data = playerDoc.data();
      if (typeof data.ownerUid === 'string') continue; // already stamped
      const ownerUid = ownerByTeam.get(data.draftedByTeam) ?? '';
      if (ownerUid === '' && !ownerByTeam.has(data.draftedByTeam)) {
        console.warn(`  ${leagueDoc.id}: team "${data.draftedByTeam}" not in league doc — stamping ''`);
      }
      updates.push({ ref: playerDoc.ref, ownerUid });
    }

    console.log(`League ${leagueDoc.id}: ${playersSnap.size} players, ${updates.length} to update`);

    if (commitMode) {
      for (let i = 0; i < updates.length; i += 500) {
        const batch = db.batch();
        updates.slice(i, i + 500).forEach((u) => batch.update(u.ref, { ownerUid: u.ownerUid }));
        await batch.commit();
      }
    }
    totalUpdated += updates.length;
  }

  console.log(`\n${commitMode ? 'Updated' : 'Would update'} ${totalUpdated} draftedPlayers docs.`);
  if (!commitMode) console.log('Run with --commit to execute.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
