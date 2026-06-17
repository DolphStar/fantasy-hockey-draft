/**
 * Apply pending roster swaps for a single league every Saturday. Scoped by
 * leagueId so it never touches another league's players. Admin SDK; safe from cron.
 */

import { getAdminDb } from '../firebaseAdmin.js';
import { isRosterSwapDayOfWeek } from './helpers.js';

export interface RosterSwapResult {
  success: boolean;
  swapsApplied: number;
  message?: string;
  error?: string;
}

export interface LeagueSwapPlayer {
  name?: string;
  pendingSlot?: string | null;
  update: (patch: { rosterSlot: string; pendingSlot: null; lastSwapDate: string }) => Promise<void>;
}

export interface RosterSwapDeps {
  getLeaguePlayers: (leagueId: string) => Promise<LeagueSwapPlayer[]>;
}

export async function applyRosterSwaps(
  leagueId: string,
  now: Date = new Date(),
  deps: RosterSwapDeps = defaultRosterSwapDeps(),
): Promise<RosterSwapResult> {
  if (!isRosterSwapDayOfWeek(now.getDay())) {
    return { success: true, swapsApplied: 0, message: 'Not Saturday' };
  }

  try {
    const players = await deps.getLeaguePlayers(leagueId);
    let swapsApplied = 0;

    for (const player of players) {
      if (player.pendingSlot) {
        await player.update({
          rosterSlot: player.pendingSlot,
          pendingSlot: null,
          lastSwapDate: now.toISOString(),
        });
        swapsApplied++;
      }
    }

    console.log(`League ${leagueId}: applied ${swapsApplied} roster swaps`);
    return { success: true, swapsApplied, message: `Applied ${swapsApplied} roster swaps` };
  } catch (error) {
    console.error(`League ${leagueId}: error applying roster swaps:`, error);
    return {
      success: false,
      swapsApplied: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** Production wiring: read this league's drafted players from Firestore. */
export function defaultRosterSwapDeps(): RosterSwapDeps {
  return {
    getLeaguePlayers: async (leagueId) => {
      const db = await getAdminDb();
      const snapshot = await db
        .collection('draftedPlayers')
        .where('leagueId', '==', leagueId)
        .get();
      return snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          name: data.name as string | undefined,
          pendingSlot: (data.pendingSlot ?? null) as string | null,
          update: async (patch) => {
            await docSnap.ref.update(patch);
          },
        };
      });
    },
  };
}
