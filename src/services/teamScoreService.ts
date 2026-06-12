import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

import { db } from '../firebase';
import type { TeamScore } from '../types/scores';

/** Subscribe to every team's score doc for a league, sorted by total points (desc). */
export function subscribeLeagueTeamScores(
  leagueId: string,
  onScores: (scores: TeamScore[]) => void,
) {
  const scoresQuery = query(
    collection(db, `leagues/${leagueId}/teamScores`),
    orderBy('totalPoints', 'desc'),
  );

  return onSnapshot(scoresQuery, (snapshot) => {
    onScores(snapshot.docs.map((docSnapshot) => docSnapshot.data() as TeamScore));
  });
}
