import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

import { db } from '../firebase';
import { createInitialDraftState } from '../utils/draftLogic';
import type { DraftState } from '../utils/draftLogic';
import type { League } from '../types/league';

async function deleteCollectionDocs(path: string) {
  const snapshot = await getDocs(collection(db, path));
  await Promise.all(snapshot.docs.map((docSnapshot) => deleteDoc(doc(db, path, docSnapshot.id))));
}

export async function ensureDraftState(league: League): Promise<DraftState> {
  const draftDocRef = doc(db, 'drafts', league.id);
  const draftDoc = await getDoc(draftDocRef);

  if (draftDoc.exists()) {
    return draftDoc.data() as DraftState;
  }

  const initialState = createInitialDraftState(
    league.teams.map(team => team.teamName),
    league.draftRounds,
  );
  await setDoc(draftDocRef, initialState);
  return initialState;
}

export function subscribeToDraftState(
  leagueId: string,
  onDraftState: (draftState: DraftState | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'drafts', leagueId),
    (snapshot) => {
      onDraftState(snapshot.exists() ? (snapshot.data() as DraftState) : null);
    },
    (error) => onError(error),
  );
}

export async function advanceDraftState(leagueId: string, draftState: DraftState) {
  const nextPickNumber = draftState.currentPickNumber + 1;
  await updateDoc(doc(db, 'drafts', leagueId), {
    currentPickNumber: nextPickNumber,
    isComplete: nextPickNumber > draftState.totalPicks,
  });
}

export async function resetDraftForLeague(league: League) {
  await deleteCollectionDocs('draftedPlayers');
  await deleteCollectionDocs(`leagues/${league.id}/playerDailyScores`);
  await deleteCollectionDocs(`leagues/${league.id}/teamScores`);
  await deleteCollectionDocs(`leagues/${league.id}/liveStats`);

  const initialState = createInitialDraftState(
    league.teams.map(team => team.teamName),
    league.draftRounds,
  );
  await setDoc(doc(db, 'drafts', league.id), initialState);
}
