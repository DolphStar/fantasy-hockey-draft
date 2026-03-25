import { collection, doc, onSnapshot } from 'firebase/firestore';

import { db } from '../firebase';

export interface TeamScoreSummary {
  teamPoints: number;
  leagueAveragePoints: number;
}

export function subscribeLeagueTeamScoreSummary(
  leagueId: string,
  teamName: string,
  onSummary: (summary: TeamScoreSummary) => void,
) {
  let teamPoints = 0;
  let leagueAveragePoints = 0;

  const publish = () => onSummary({ teamPoints, leagueAveragePoints });

  const unsubTeam = onSnapshot(doc(db, `leagues/${leagueId}/teamScores`, teamName), (snapshot) => {
    teamPoints = snapshot.data()?.totalPoints ?? 0;
    publish();
  });

  const unsubLeague = onSnapshot(collection(db, `leagues/${leagueId}/teamScores`), (snapshot) => {
    if (snapshot.empty) {
      leagueAveragePoints = 0;
      publish();
      return;
    }

    const totals = snapshot.docs.map((docSnapshot) => docSnapshot.data()?.totalPoints ?? 0);
    const avg = totals.reduce((sum, value) => sum + value, 0) / totals.length;
    leagueAveragePoints = Number(avg.toFixed(1));
    publish();
  });

  return () => {
    unsubTeam();
    unsubLeague();
  };
}
