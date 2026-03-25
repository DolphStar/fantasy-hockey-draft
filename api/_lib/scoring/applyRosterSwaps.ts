/**
 * Apply pending roster swaps every Saturday (mirrors `src/utils/applyRosterSwaps` behavior).
 * Uses Firebase Admin; safe to run from Vercel cron.
 */

import { getAdminDb } from '../firebaseAdmin.js';
import { isRosterSwapDayOfWeek } from './helpers.js';

export interface RosterSwapResult {
  success: boolean;
  swapsApplied: number;
  message?: string;
  error?: string;
}

export async function applyRosterSwaps(now = new Date()): Promise<RosterSwapResult> {
  const dayOfWeek = now.getDay();

  if (!isRosterSwapDayOfWeek(dayOfWeek)) {
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    console.log(
      `⏰ Roster swaps only apply on Saturdays. Today is ${dayNames[dayOfWeek]}`,
    );
    return { success: true, swapsApplied: 0, message: 'Not Saturday' };
  }

  try {
    console.log('📅 Saturday detected - applying pending roster swaps...');

    const db = await getAdminDb();
    const snapshot = await db.collection('draftedPlayers').get();

    let swapsApplied = 0;

    for (const docSnap of snapshot.docs) {
      const player = docSnap.data();

      if (player.pendingSlot) {
        console.log(`Applying swap: ${player.name} → ${player.pendingSlot}`);

        await docSnap.ref.update({
          rosterSlot: player.pendingSlot,
          pendingSlot: null,
          lastSwapDate: now.toISOString(),
        });

        swapsApplied++;
      }
    }

    console.log(`✅ Applied ${swapsApplied} roster swaps`);

    return {
      success: true,
      swapsApplied,
      message: `Applied ${swapsApplied} roster swaps`,
    };
  } catch (error) {
    console.error('❌ Error applying roster swaps:', error);
    return {
      success: false,
      swapsApplied: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
