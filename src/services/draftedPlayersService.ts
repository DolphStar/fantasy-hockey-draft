import { collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where, type QueryConstraint } from 'firebase/firestore';

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

  await Promise.all([
    updateDoc(doc(db, 'draftedPlayers', playerOne.id), { pendingSlot: playerTwoSlot }),
    updateDoc(doc(db, 'draftedPlayers', playerTwo.id), { pendingSlot: playerOneSlot }),
  ]);
}

export async function clearPendingRosterSwap(playerId: string) {
  await updateDoc(doc(db, 'draftedPlayers', playerId), { pendingSlot: null });
}
