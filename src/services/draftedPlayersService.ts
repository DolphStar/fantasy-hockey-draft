import { collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where, writeBatch, type QueryConstraint } from 'firebase/firestore';

import { db } from '../firebase';
import type { DraftedPlayer } from '../types/draftedPlayer';

function toDraftedPlayers(snapshot: { docs: Array<{ id: string; data(): unknown }> }): DraftedPlayer[] {
  return snapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...(docSnapshot.data() as Omit<DraftedPlayer, 'id'>),
  }));
}

export function subscribeDraftedPlayersByLeague(
  leagueId: string,
  onPlayers: (players: DraftedPlayer[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    query(
      collection(db, 'draftedPlayers'),
      where('leagueId', '==', leagueId),
      orderBy('pickNumber', 'asc'),
    ),
    (snapshot) => onPlayers(toDraftedPlayers(snapshot)),
    onError,
  );
}

export function subscribeDraftedPlayersByTeam(
  leagueId: string,
  teamName: string,
  onPlayers: (players: DraftedPlayer[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    query(
      collection(db, 'draftedPlayers'),
      where('leagueId', '==', leagueId),
      where('draftedByTeam', '==', teamName),
      orderBy('pickNumber', 'asc'),
    ),
    (snapshot) => onPlayers(toDraftedPlayers(snapshot)),
    onError,
  );
}

export async function fetchDraftedPlayers(
  leagueId: string,
  options: { teamName?: string; activeOnly?: boolean } = {},
): Promise<DraftedPlayer[]> {
  const constraints: QueryConstraint[] = [where('leagueId', '==', leagueId)];
  if (options.teamName) {
    constraints.push(where('draftedByTeam', '==', options.teamName));
  }

  const snapshot = await getDocs(query(collection(db, 'draftedPlayers'), ...constraints));
  const players = toDraftedPlayers(snapshot);

  if (options.activeOnly) {
    return players.filter((player) => !player.rosterSlot || player.rosterSlot === 'active');
  }

  return players;
}

export async function requestRosterSwap(playerOne: DraftedPlayer, playerTwo: DraftedPlayer) {
  const playerOneSlot = playerOne.rosterSlot || 'active';
  const playerTwoSlot = playerTwo.rosterSlot || 'active';

  // Atomic pair write: each side records the other's doc id so a later
  // cancel can undo both halves (a one-sided pendingSlot would get applied
  // alone at roster lock and leave the lineup lopsided).
  const batch = writeBatch(db);
  batch.update(doc(db, 'draftedPlayers', playerOne.id), { pendingSlot: playerTwoSlot, pendingSwapWith: playerTwo.id });
  batch.update(doc(db, 'draftedPlayers', playerTwo.id), { pendingSlot: playerOneSlot, pendingSwapWith: playerOne.id });
  await batch.commit();
}

export async function clearPendingRosterSwap(player: DraftedPlayer) {
  const clearPatch = { pendingSlot: null, pendingSwapWith: null };
  if (player.pendingSwapWith) {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'draftedPlayers', player.id), clearPatch);
      batch.update(doc(db, 'draftedPlayers', player.pendingSwapWith), clearPatch);
      await batch.commit();
      return;
    } catch {
      // Partner doc missing (deleted player / stale link) — fall through and
      // at least clear this side.
    }
  }
  await updateDoc(doc(db, 'draftedPlayers', player.id), clearPatch);
}
